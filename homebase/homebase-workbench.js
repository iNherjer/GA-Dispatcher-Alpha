(() => {
  'use strict';

  const RELAY_URL = 'wss://websocketrelais.onrender.com/';
  const URL_PARAMS = new URLSearchParams(window.location.search);
  const INTEGRATED = URL_PARAMS.get('integrated') === '1' && window.parent !== window;
  const STANDALONE_ID = String(URL_PARAMS.get('syncId') || '').trim();
  const STANDALONE_PIN = String(URL_PARAMS.get('pin') || '').trim();
  const PARENT_ORIGIN = window.location.origin;
  const STORAGE_KEY = 'vfr-homebase-workbench-v2';
  const SYNC_META_KEY = 'vfr-homebase-workbench-sync-v1';
  const DEVICE_ID_KEY = 'vfr-homebase-device-id';
  const ASSET_CATALOG = globalThis.HOMEBASE_ASSET_CATALOG;
  if (!ASSET_CATALOG?.assets?.length) throw new Error('Der gemeinsame Homebase-Assetkatalog wurde nicht geladen.');
  const ASSET_BY_KEY = new Map(ASSET_CATALOG.assets.map((entry) => [entry.key, entry]));
  const HANGAR_TITLE = ASSET_BY_KEY.get('hangar').title;
  const OPEN_PARKING_TITLE = ASSET_BY_KEY.get('openParking').title;
  const HANGAR_TITLES = new Set(ASSET_CATALOG.assets
    .filter((entry) => entry.kind === 'hangar' && entry.workbenchVisible !== false && entry.homebasePlaceable !== false)
    .map((entry) => entry.title));
  const SPAWN_PROBE_ID = '__homebase_spawn_probe__';
  const SPAWN_PROBE_TITLE = ASSET_BY_KEY.get('spawnProbe').title;
  const OBJECT_CATALOG = [
    ...ASSET_CATALOG.stockObjects.filter((entry) => entry.workbenchVisible !== false).map((entry) => ({ ...entry })),
    ...ASSET_CATALOG.assets.filter((entry) => entry.kind === 'object' && entry.workbenchVisible !== false && entry.homebasePlaceable !== false).map((entry) => ({
      group: entry.group, title: entry.title, label: entry.label, icon: entry.icon, companion: true
    }))
  ];
  const CATALOG_BY_TITLE = new Map(OBJECT_CATALOG.map((entry) => [entry.title, entry]));
  const LEGACY_TITLE_ALIASES = new Map(Object.entries(ASSET_CATALOG.legacyTitleAliases || {}));
  const COMPANION_TITLES = new Set(OBJECT_CATALOG.filter((entry) => !entry.persistentOnly).map((entry) => entry.title));
  const PERSISTENT_ONLY_TITLES = new Set(OBJECT_CATALOG.filter((entry) => entry.persistentOnly).map((entry) => entry.title));
  const DEFAULT = {
    spawn: { lat: 48.1504, lon: 7.7099, altFt: 620, heading: 90, mode: 'airport_parking' },
    hangar: { northM: 0, eastM: 0, heading: 90, heightFt: 0, widthM: 18, depthM: 22, objectTitle: HANGAR_TITLE },
    objects: []
  };

  const hadLocalState = localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem('vfr-homebase-workbench-v1') !== null;
  const state = loadState();
  let syncMeta = loadSyncMeta();
  let socket = null;
  let reconnectTimer = null;
  let trackerLastSeen = 0;
  let lastTelemetry = null;
  let lastGroundAltitude = null;
  let pendingProbeMoveCommandId = null;
  let spawnProbeEnabled = false;
  let commandSeq = 0;
  let objectSeq = state.objects.length;
  let previewInFlightId = null;
  let previewWaitsForExtras = false;
  let previewQueued = false;
  let clearQueued = false;
  let previewTeardown = null;
  let primaryTeardown = null;
  const abandonedPrimaryCommandIds = new Set();
  let previewWatchdog = null;
  let centeredOnce = false;
  let selectedObjectId = state.objects[0]?.id || null;
  let localAssetInspection = null;
  let assetInstallCheckInFlight = false;
  let assetPromptedSignature = '';
  let environmentOpened = !INTEGRATED;
  let livePreviewReady = false;
  const liveMoveTimers = new Map();
  const liveObjectIds = new Set();
  const pendingLiveObjectMoves = new Map();
  const integratedRpcPending = new Map();
  let integratedRpcSeq = 0;
  let integratedMessageBound = false;

  const $ = (id) => document.getElementById(id);
  const map = L.map('map', { zoomControl: true }).setView([state.spawn.lat, state.spawn.lon], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap-Mitwirkende'
  }).addTo(map);

  const markerIcon = (className, text) => L.divIcon({
    className: '',
    html: `<div class="${className}">${text}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const planeMarker = L.marker([state.spawn.lat, state.spawn.lon], { icon: markerIcon('plane-icon', '✈'), opacity: 0 }).addTo(map);
  const spawnMarker = L.marker([state.spawn.lat, state.spawn.lon], { icon: markerIcon('spawn-icon', 'S'), draggable: true }).addTo(map);
  const hangarMarker = L.marker(hangarPosition(), { icon: markerIcon('hangar-icon', 'H'), draggable: true }).addTo(map);
  const hangarPolygon = L.polygon(hangarCorners(), { color: '#bbf451', weight: 2, fillColor: '#164b2b', fillOpacity: .28 }).addTo(map);
  const spawnHeadingLine = L.polyline(headingLine(state.spawn.lat, state.spawn.lon, state.spawn.heading, 15), { color: '#ffb44a', weight: 3 }).addTo(map);
  const hp0 = hangarPosition();
  const hangarHeadingLine = L.polyline(headingLine(hp0.lat, hp0.lng, state.hangar.heading, Math.max(10, state.hangar.depthM * .65)), { color: '#bbf451', weight: 3 }).addTo(map);
  const objectMarkers = new Map();

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeHeading(value) {
    return ((Math.round(finite(value, 0)) % 360) + 360) % 360;
  }

  function normalizeHangarTitle(value) {
    const rawTitle = String(value || '');
    const title = LEGACY_TITLE_ALIASES.get(rawTitle) || rawTitle;
    return HANGAR_TITLES.has(title) ? title : HANGAR_TITLE;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }

  function normalizeObject(raw, index = 0) {
    const rawTitle = String(raw?.title || '');
    const catalog = CATALOG_BY_TITLE.get(LEGACY_TITLE_ALIASES.get(rawTitle) || rawTitle);
    const fallback = OBJECT_CATALOG[0];
    return {
      id: String(raw?.id || `obj-migrated-${index}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `obj-migrated-${index}`,
      title: catalog?.title || rawTitle || fallback.title,
      label: catalog?.label || String(raw?.label || rawTitle || fallback.label),
      northM: clamp(raw?.northM, -2000, 2000),
      eastM: clamp(raw?.eastM, -2000, 2000),
      heading: normalizeHeading(raw?.heading),
      heightFt: clamp(raw?.heightFt, -20, 200),
      scale: clamp(raw?.scale ?? 1, .1, 10)
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.spawn && saved?.hangar) {
        return {
          spawn: { ...DEFAULT.spawn, ...saved.spawn },
          hangar: { ...DEFAULT.hangar, ...saved.hangar, widthM: 18, depthM: 22, objectTitle: normalizeHangarTitle(saved.hangar.objectTitle) },
          objects: Array.isArray(saved.objects) ? saved.objects.slice(0, 100).map(normalizeObject) : []
        };
      }
      const legacy = JSON.parse(localStorage.getItem('vfr-homebase-workbench-v1') || 'null');
      if (legacy?.spawn && legacy?.hangar) {
        return { spawn: { ...DEFAULT.spawn, ...legacy.spawn }, hangar: { ...DEFAULT.hangar, ...legacy.hangar, widthM: 18, depthM: 22, objectTitle: normalizeHangarTitle(legacy.hangar.objectTitle) }, objects: [] };
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }

  function getDeviceId() {
    let value = localStorage.getItem(DEVICE_ID_KEY) || '';
    if (!value) {
      value = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, value);
    }
    return value;
  }

  function loadSyncMeta() {
    try {
      const saved = JSON.parse(localStorage.getItem(SYNC_META_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        return {
          deviceId: String(saved.deviceId || getDeviceId()),
          localUpdatedAt: finite(saved.localUpdatedAt, 0),
          baseRevision: String(saved.baseRevision || ''),
          cloudUpdatedAt: finite(saved.cloudUpdatedAt, 0),
          dirty: saved.dirty === true,
          crewShareEnabled: saved.crewShareEnabled !== false
        };
      }
    } catch (_) {}
    return { deviceId: getDeviceId(), localUpdatedAt: hadLocalState ? Date.now() : 0, baseRevision: '', cloudUpdatedAt: 0, dirty: hadLocalState, crewShareEnabled: true };
  }

  function persistSyncMeta() {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(syncMeta));
  }

  function postSyncDraft() {
    if (!INTEGRATED) return;
    window.parent.postMessage({
      channel: 'vfr-homebase',
      kind: 'sync-draft',
      plan: state,
      dirty: syncMeta.dirty,
      baseRevision: syncMeta.baseRevision,
      localUpdatedAt: syncMeta.localUpdatedAt,
      deviceId: syncMeta.deviceId,
      crewShareEnabled: syncMeta.crewShareEnabled === true
    }, PARENT_ORIGIN);
  }

  function saveState(options = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (options.markDirty !== false) {
      syncMeta.dirty = true;
      syncMeta.localUpdatedAt = Date.now();
    }
    persistSyncMeta();
    postSyncDraft();
  }

  function normalizedPlan(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      spawn: { ...DEFAULT.spawn, ...(source.spawn || {}), heading: normalizeHeading(source.spawn?.heading), mode: 'airport_parking' },
      hangar: {
        ...DEFAULT.hangar,
        ...(source.hangar || {}),
        objectTitle: normalizeHangarTitle(source.hangar?.objectTitle),
        widthM: clamp(source.hangar?.widthM ?? 18, 4, 80),
        depthM: clamp(source.hangar?.depthM ?? 22, 4, 100)
      },
      objects: Array.isArray(source.objects) ? source.objects.slice(0, 100).map(normalizeObject) : []
    };
  }

  function applyCloudRecord(record) {
    const plan = normalizedPlan(record?.plan);
    state.spawn = plan.spawn;
    state.hangar = plan.hangar;
    state.objects = plan.objects;
    selectedObjectId = state.objects[0]?.id || null;
    objectSeq = state.objects.length;
    syncMeta.baseRevision = String(record?.revision || '');
    syncMeta.cloudUpdatedAt = finite(record?.updatedAt, Date.now());
    syncMeta.localUpdatedAt = finite(record?.clientUpdatedAt, syncMeta.cloudUpdatedAt);
    syncMeta.crewShareEnabled = record?.crewShareEnabled !== false;
    syncMeta.dirty = false;
    saveState({ markDirty: false });
    syncInputsFromState();
    updateMap();
    map.setView([state.spawn.lat, state.spawn.lon], map.getZoom());
  }

  function plansEqual(left, right) {
    try { return JSON.stringify(normalizedPlan(left)) === JSON.stringify(normalizedPlan(right)); } catch (_) { return false; }
  }

  function resolveCloudConflict(record, source = 'load') {
    if (!record?.plan) return;
    const crewShareMatches = (record?.crewShareEnabled !== false) === (syncMeta.crewShareEnabled === true);
    if (plansEqual(state, record.plan) && crewShareMatches) {
      syncMeta.baseRevision = String(record.revision || '');
      syncMeta.cloudUpdatedAt = finite(record.updatedAt, Date.now());
      syncMeta.dirty = false;
      saveState({ markDirty: false });
      setPill('syncPill', 'Homebase synchronisiert', 'ok');
      return;
    }
    if (!syncMeta.dirty) {
      applyCloudRecord(record);
      setPill('syncPill', 'Cloud-Version geladen', 'ok');
      log('Aktuellere Homebase-Planung der Pilot-ID geladen.', 'ok');
      return;
    }
    const cloudTime = finite(record.updatedAt, 0) ? new Date(record.updatedAt).toLocaleString('de-DE') : 'unbekannt';
    const useCloud = window.confirm(
      `Die Homebase wurde auf einem anderen Gerät geändert (${cloudTime}).\n\n` +
      'OK lädt die Cloud-Version.\nAbbrechen behält diese lokale Version und speichert sie als neuen Stand.'
    );
    if (useCloud) {
      applyCloudRecord(record);
      setPill('syncPill', 'Cloud-Version geladen', 'ok');
      log('Cloud-Version der Homebase übernommen.', 'ok');
      return;
    }
    syncMeta.baseRevision = String(record.revision || '');
    syncMeta.cloudUpdatedAt = finite(record.updatedAt, 0);
    syncMeta.dirty = true;
    persistSyncMeta();
    postSyncDraft();
    window.parent.postMessage({ channel: 'vfr-homebase', kind: 'sync-save-now', reason: `${source}-conflict-local` }, PARENT_ORIGIN);
    setPill('syncPill', 'Lokale Version wird gespeichert', 'warn');
  }

  function offsetLatLon(lat, lon, northM, eastM) {
    const radius = 6371000;
    const latRad = lat * Math.PI / 180;
    return {
      lat: lat + (northM / radius) * 180 / Math.PI,
      lng: lon + (eastM / (radius * Math.max(.05, Math.cos(latRad)))) * 180 / Math.PI
    };
  }

  function localOffsetMeters(baseLat, baseLon, lat, lon) {
    const radius = 6371000;
    return {
      northM: (lat - baseLat) * Math.PI / 180 * radius,
      eastM: (lon - baseLon) * Math.PI / 180 * radius * Math.cos(baseLat * Math.PI / 180)
    };
  }

  function headingLine(lat, lon, heading, lengthM) {
    const radians = normalizeHeading(heading) * Math.PI / 180;
    const end = offsetLatLon(lat, lon, Math.cos(radians) * lengthM, Math.sin(radians) * lengthM);
    return [[lat, lon], [end.lat, end.lng]];
  }

  function hangarPosition() {
    return offsetLatLon(state.spawn.lat, state.spawn.lon, state.hangar.northM, state.hangar.eastM);
  }

  function objectPosition(item) {
    return offsetLatLon(state.spawn.lat, state.spawn.lon, item.northM, item.eastM);
  }

  function hangarCorners() {
    const center = hangarPosition();
    const heading = normalizeHeading(state.hangar.heading) * Math.PI / 180;
    const forward = { n: Math.cos(heading), e: Math.sin(heading) };
    const right = { n: -Math.sin(heading), e: Math.cos(heading) };
    const halfDepth = state.hangar.depthM / 2;
    const halfWidth = state.hangar.widthM / 2;
    return [[halfDepth, halfWidth], [halfDepth, -halfWidth], [-halfDepth, -halfWidth], [-halfDepth, halfWidth]].map(([forwardM, rightM]) => {
      const point = offsetLatLon(center.lat, center.lng, forward.n * forwardM + right.n * rightM, forward.e * forwardM + right.e * rightM);
      return [point.lat, point.lng];
    });
  }

  function selectedObject() {
    return state.objects.find((item) => item.id === selectedObjectId) || null;
  }

  function setPill(id, text, kind) {
    const element = $(id);
    element.textContent = text;
    element.className = `pill ${kind}`;
  }

  function log(message, level = 'info') {
    const time = new Date().toLocaleTimeString('de-DE');
    const prefix = level === 'error' ? 'FEHLER' : level === 'ok' ? 'OK' : 'INFO';
    const element = $('log');
    element.textContent += `[${time}] ${prefix}  ${message}\n`;
    element.scrollTop = element.scrollHeight;
  }

  function setResult(id, text, ok = null) {
    const element = $(id);
    element.textContent = text;
    element.className = `result-line${ok === true ? ' ok' : ok === false ? ' bad' : ''}`;
  }

  function fillCatalog() {
    const groups = new Map();
    OBJECT_CATALOG.forEach((entry) => {
      if (!groups.has(entry.group)) groups.set(entry.group, []);
      groups.get(entry.group).push(entry);
    });
    $('catalogSelect').textContent = '';
    groups.forEach((entries, name) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = name;
      entries.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.title;
        option.textContent = `${entry.icon} ${entry.label}`;
        optgroup.append(option);
      });
      $('catalogSelect').append(optgroup);
    });
  }

  function mergeRuntimeAssetCatalog(entries) {
    let added = 0;
    for (const raw of Array.isArray(entries) ? entries : []) {
      const title = String(raw?.title || '').trim().slice(0, 160);
      const folder = String(raw?.folder || '').trim().slice(0, 120);
      const kind = String(raw?.kind || '').trim().toLowerCase();
      if (!title.startsWith('VFR Multitool Homebase ') || !/^VFRHomebase[A-Za-z0-9_-]+$/.test(folder)) continue;
      if (!['object', 'hangar'].includes(kind)) continue;
      if (raw?.workbenchVisible === false || raw?.homebasePlaceable === false) continue;
      if (kind === 'hangar') {
        if (HANGAR_TITLES.has(title)) continue;
        HANGAR_TITLES.add(title);
        const option = document.createElement('option');
        option.value = title;
        option.textContent = String(raw?.label || title.replace(/^VFR Multitool Homebase /, '')).slice(0, 120);
        $('hangarSelect').append(option);
        added += 1;
        continue;
      }
      if (CATALOG_BY_TITLE.has(title)) continue;
      const group = String(raw?.group || 'Weitere Objekte').trim().slice(0, 80);
      const entry = {
        key: String(raw?.key || folder).trim().slice(0, 120),
        folder,
        title,
        kind,
        group,
        label: String(raw?.label || title.replace(/^VFR Multitool Homebase /, '')).trim().slice(0, 120),
        icon: group.toLowerCase().includes('gepäck') ? '🧳' : '◆',
        companion: true
      };
      OBJECT_CATALOG.push(entry);
      CATALOG_BY_TITLE.set(title, entry);
      COMPANION_TITLES.add(title);
      added += 1;
    }
    if (added) {
      fillCatalog();
      renderObjectList();
      updateMap();
      log(`${added} neue Asset-Katalogeinträge vom installierten Paket übernommen.`, 'ok');
    }
    return added;
  }

  function renderObjectList() {
    const list = $('objectList');
    list.textContent = '';
    $('objectCount').textContent = `${state.objects.length} ${state.objects.length === 1 ? 'Objekt' : 'Objekte'}`;
    $('objectEmpty').hidden = state.objects.length > 0;
    state.objects.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `object-list-item${item.id === selectedObjectId ? ' selected' : ''}`;
      const catalog = CATALOG_BY_TITLE.get(item.title);
      button.innerHTML = `<span class="object-index">${index + 1}</span><span><strong>${catalog?.icon || '•'} ${item.label}</strong><small>${item.northM.toFixed(1)} m N · ${item.eastM.toFixed(1)} m O · ${item.heightFt.toFixed(1)} ft</small></span>`;
      button.addEventListener('click', () => selectObject(item.id));
      list.append(button);
    });

    const item = selectedObject();
    $('objectEditor').disabled = !item;
    $('objectEditorTitle').textContent = item ? `${item.label} bearbeiten` : 'Objekt bearbeiten';
    if (item) {
      $('objectNorth').value = Number(item.northM.toFixed(2));
      $('objectEast').value = Number(item.eastM.toFixed(2));
      $('objectHeading').value = normalizeHeading(item.heading);
      $('objectHeadingOut').textContent = `${normalizeHeading(item.heading)}°`;
      $('objectHeight').value = Number(item.heightFt.toFixed(2));
      $('objectScale').value = Number(item.scale.toFixed(2));
    }
  }

  function syncInputsFromState() {
    $('spawnLat').value = state.spawn.lat.toFixed(7);
    $('spawnLon').value = state.spawn.lon.toFixed(7);
    $('spawnAlt').value = Math.round(state.spawn.altFt);
    $('spawnHeading').value = normalizeHeading(state.spawn.heading);
    $('spawnHeadingOut').textContent = `${normalizeHeading(state.spawn.heading)}°`;
    $('spawnMode').value = state.spawn.mode;
    $('hangarNorth').value = Number(state.hangar.northM.toFixed(2));
    $('hangarEast').value = Number(state.hangar.eastM.toFixed(2));
    $('hangarHeading').value = normalizeHeading(state.hangar.heading);
    $('hangarHeadingOut').textContent = `${normalizeHeading(state.hangar.heading)}°`;
    $('hangarHeight').value = Number(state.hangar.heightFt.toFixed(2));
    $('hangarWidth').value = state.hangar.widthM;
    $('hangarDepth').value = state.hangar.depthM;
    $('hangarSelect').value = normalizeHangarTitle(state.hangar.objectTitle);
    $('crewShareToggle').checked = syncMeta.crewShareEnabled === true;
    renderObjectList();
  }

  function updateObjectMarkers() {
    const currentIds = new Set(state.objects.map((item) => item.id));
    objectMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) { map.removeLayer(marker); objectMarkers.delete(id); }
    });
    state.objects.forEach((item, index) => {
      const catalog = CATALOG_BY_TITLE.get(item.title);
      let marker = objectMarkers.get(item.id);
      if (!marker) {
        marker = L.marker(objectPosition(item), { icon: markerIcon('object-icon', String(index + 1)), draggable: true }).addTo(map);
        marker.on('click', (event) => { L.DomEvent.stopPropagation(event); selectObject(item.id); });
        marker.on('dragend', () => {
          const point = marker.getLatLng();
          const offset = localOffsetMeters(state.spawn.lat, state.spawn.lon, point.lat, point.lng);
          item.northM = offset.northM; item.eastM = offset.eastM;
          selectedObjectId = item.id;
          saveState(); syncInputsFromState(); updateMap(); scheduleLiveObjectMove(item);
        });
        objectMarkers.set(item.id, marker);
      }
      marker.setLatLng(objectPosition(item));
      marker.setIcon(markerIcon(`object-icon${item.id === selectedObjectId ? ' selected' : ''}`, String(index + 1)));
      marker.bindTooltip(`${catalog?.icon || '•'} ${item.label}`, { direction: 'top', offset: [0, -12] });
      marker.setZIndexOffset(item.id === selectedObjectId ? 1000 : 100 + index);
    });
  }

  function updateMap() {
    spawnMarker.setLatLng([state.spawn.lat, state.spawn.lon]);
    const hp = hangarPosition();
    hangarMarker.setLatLng(hp);
    hangarPolygon.setLatLngs(hangarCorners());
    spawnHeadingLine.setLatLngs(headingLine(state.spawn.lat, state.spawn.lon, state.spawn.heading, 15));
    hangarHeadingLine.setLatLngs(headingLine(hp.lat, hp.lng, state.hangar.heading, Math.max(10, state.hangar.depthM * .65)));
    updateObjectMarkers();
  }

  function readSpawnStateFromInputs() {
    state.spawn.lat = clamp($('spawnLat').value, -90, 90);
    state.spawn.lon = clamp($('spawnLon').value, -180, 180);
    state.spawn.altFt = finite($('spawnAlt').value, state.spawn.altFt);
    state.spawn.heading = normalizeHeading($('spawnHeading').value);
    state.spawn.mode = 'airport_parking';
    saveState(); syncInputsFromState(); updateMap();
    invalidateLivePreview();
  }

  function readHangarStateFromInputs(event) {
    state.hangar.northM = clamp($('hangarNorth').value, -1000, 1000);
    state.hangar.eastM = clamp($('hangarEast').value, -1000, 1000);
    state.hangar.heading = normalizeHeading($('hangarHeading').value);
    state.hangar.heightFt = clamp($('hangarHeight').value, -50, 200);
    state.hangar.widthM = clamp($('hangarWidth').value, 4, 80);
    state.hangar.depthM = clamp($('hangarDepth').value, 4, 100);
    state.hangar.objectTitle = normalizeHangarTitle($('hangarSelect').value || state.hangar.objectTitle);
    saveState(); syncInputsFromState(); updateMap();
    if (!['hangarWidth', 'hangarDepth'].includes(event?.target?.id)) scheduleLiveHangarMove();
  }

  function readSelectedObjectFromInputs(event) {
    const item = selectedObject();
    if (!item) return;
    item.northM = clamp($('objectNorth').value, -2000, 2000);
    item.eastM = clamp($('objectEast').value, -2000, 2000);
    item.heading = normalizeHeading($('objectHeading').value);
    item.heightFt = clamp($('objectHeight').value, -20, 200);
    item.scale = clamp($('objectScale').value, .1, 10);
    saveState(); syncInputsFromState(); updateMap();
    if (event?.target?.id === 'objectScale') {
      setResult('previewResult', 'Maßstabsänderungen werden beim nächsten vollständigen Vorschau-Aufbau übernommen.');
    } else {
      scheduleLiveObjectMove(item);
    }
  }

  function selectObject(id) {
    selectedObjectId = state.objects.some((item) => item.id === id) ? id : null;
    syncInputsFromState(); updateMap();
  }

  function addObject(title, source = null) {
    if (state.objects.length >= 100) { log('Maximal 100 Ausstattungsobjekte sind erlaubt.', 'error'); return; }
    const catalog = CATALOG_BY_TITLE.get(title);
    if (!catalog) return;
    const spread = state.objects.length;
    const item = normalizeObject({
      id: `obj-${Date.now()}-${++objectSeq}`,
      title,
      northM: source ? source.northM + .5 : state.hangar.northM - 3 - Math.floor(spread / 5) * 1.5,
      eastM: source ? source.eastM + .5 : state.hangar.eastM - 4 + (spread % 5) * 2,
      heading: source?.heading ?? state.hangar.heading,
      heightFt: source?.heightFt ?? 0,
      scale: source?.scale ?? 1
    }, state.objects.length);
    state.objects.push(item);
    selectedObjectId = item.id;
    saveState(); syncInputsFromState(); updateMap(); sendLiveObjectAdd(item);
    log(`${catalog.label} hinzugefügt.`, 'ok');
  }

  function deleteSelectedObject() {
    const index = state.objects.findIndex((item) => item.id === selectedObjectId);
    if (index < 0) return;
    const [removed] = state.objects.splice(index, 1);
    selectedObjectId = state.objects[Math.min(index, state.objects.length - 1)]?.id || null;
    clearTimeout(liveMoveTimers.get(removed.id));
    liveMoveTimers.delete(removed.id);
    liveObjectIds.delete(removed.id);
    saveState(); syncInputsFromState(); updateMap();
    if (!PERSISTENT_ONLY_TITLES.has(removed.title)) {
      const commandId = sendStabilizerCommand('homebase_v1.preview.object.remove', {
        id: removed.id,
        label: removed.label
      });
      setResult(
        'previewResult',
        commandId
          ? `${removed.label} wird aus der Live-Vorschau entfernt …`
          : `${removed.label} wurde aus dem Plan entfernt; die Live-Vorschau konnte nicht erreicht werden.`,
        commandId ? undefined : false
      );
    }
    log(`${removed.label} entfernt.`);
  }

  function buildConfig() {
    const hp = hangarPosition();
    return {
      protocol: 2,
      name: 'VFR Multitool Homebase',
      spawn: { lat: state.spawn.lat, lon: state.spawn.lon, altFt: state.spawn.altFt, heading: normalizeHeading(state.spawn.heading), mode: 'airport_parking' },
      hangar: {
        lat: hp.lat, lon: hp.lng, altFt: state.spawn.altFt + state.hangar.heightFt,
        heightOffsetFt: state.hangar.heightFt, heading: normalizeHeading(state.hangar.heading + 180),
        widthM: state.hangar.widthM, depthM: state.hangar.depthM, objectTitle: normalizeHangarTitle(state.hangar.objectTitle)
      },
      objects: state.objects.map((item) => {
        const position = objectPosition(item);
        return {
          id: item.id, title: item.title, label: item.label,
          lat: position.lat, lon: position.lng,
          altFt: state.spawn.altFt + item.heightFt, heightOffsetFt: item.heightFt,
          heading: normalizeHeading(item.heading), scale: item.scale
        };
      })
    };
  }

  function sendCommand(type, extra = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      log(`${type}: Relay ist nicht verbunden.`, 'error');
      return false;
    }
    const commandId = `hb-${Date.now()}-${++commandSeq}`;
    socket.send(JSON.stringify({
      type: 'gps', syncId: STANDALONE_ID, pin: STANDALONE_PIN, target: 'tracker', commandOnly: true,
      trackerCommand: { type, commandId, pin: STANDALONE_PIN, ...extra }
    }));
    log(`${type} gesendet (${commandId}).`);
    return commandId;
  }

  function sendStabilizerCommand(type, extra = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const commandId = `hb-stabilizer-${Date.now()}-${++commandSeq}`;
    socket.send(JSON.stringify({
      type: 'gps', syncId: STANDALONE_ID, pin: STANDALONE_PIN, target: 'stabilizer', commandOnly: true,
      stabilizerCommand: { type, commandId, pin: STANDALONE_PIN, ...extra }
    }));
    return commandId;
  }

  function invalidateLivePreview() {
    livePreviewReady = false;
    liveObjectIds.clear();
    for (const timer of liveMoveTimers.values()) clearTimeout(timer);
    liveMoveTimers.clear();
  }

  function queueLiveMove(key, callback, ready = livePreviewReady) {
    clearTimeout(liveMoveTimers.get(key));
    if (!ready) return;
    liveMoveTimers.set(key, setTimeout(() => {
      liveMoveTimers.delete(key);
      callback();
    }, 350));
  }

  function scheduleLiveHangarMove() {
    queueLiveMove('hangar', () => {
      const config = buildConfig();
      const object = { id: 'hangar', title: config.hangar.objectTitle, label: config.hangar.objectTitle === OPEN_PARKING_TITLE ? 'Offener Parkbereich' : 'Hangar', ...config.hangar };
      if (!sendStabilizerCommand('homebase_v1.preview.hangar.move', { object })) {
        setResult('previewResult', 'Hangar konnte nicht verschoben werden: Relay ist nicht verbunden.', false);
      }
    });
  }

  function scheduleLiveObjectMove(item) {
    if (!item) return;
    if (PERSISTENT_ONLY_TITLES.has(item.title)) {
      setResult('previewResult', `${item.label} ist nur im fertigen Paket enthalten und kann nicht live verschoben werden.`);
      return;
    }
    queueLiveMove(item.id, () => {
      const object = buildConfig().objects.find((entry) => entry.id === item.id);
      const commandId = object && sendStabilizerCommand('homebase_v1.preview.object.move', { object });
      if (!commandId) {
        setResult('previewResult', `${item.label} konnte nicht verschoben werden: Relay ist nicht verbunden.`, false);
        return;
      }
      pendingLiveObjectMoves.set(commandId, object);
    }, true);
  }

  function sendLiveObjectAdd(item) {
    if (!item) return;
    if (PERSISTENT_ONLY_TITLES.has(item.title)) {
      setResult('previewResult', `${item.label} wird als stock-basiertes Objekt erst im fertigen Paket erzeugt.`);
      return;
    }
    const object = buildConfig().objects.find((entry) => entry.id === item.id);
    if (!object || !sendStabilizerCommand('homebase_v1.preview.object.add', { object })) {
      setResult('previewResult', `${item.label} wurde gespeichert, konnte aber nicht direkt an den Simulator gesendet werden.`, false);
      return;
    }
    setResult('previewResult', `${item.label} wird als einzelnes Objekt im Simulator erzeugt …`);
  }

  function spawnProbeObject() {
    return {
      id: SPAWN_PROBE_ID,
      title: SPAWN_PROBE_TITLE,
      label: 'Gelber Spawnpunkt-Messkegel',
      lat: state.spawn.lat,
      lon: state.spawn.lon,
      altFt: state.spawn.altFt,
      heightOffsetFt: 0,
      heading: state.spawn.heading,
      scale: 1
    };
  }

  function requestSpawnProbeMove() {
    spawnProbeEnabled = true;
    const commandId = sendStabilizerCommand('homebase_v1.preview.object.move', { object: spawnProbeObject() });
    if (!commandId) {
      spawnProbeEnabled = false;
      setResult('previewResult', 'Messkegel konnte nicht gesetzt werden: Relay ist nicht verbunden.', false);
      return;
    }
    pendingProbeMoveCommandId = commandId;
    setResult('previewResult', 'Messkegel wird zum Spawnpunkt bewegt und die Bodenhöhe wird gelesen …');
  }

  function addSpawnProbe() {
    if (!sendStabilizerCommand('homebase_v1.preview.object.add', { object: spawnProbeObject() })) {
      setResult('previewResult', 'Messkegel konnte nicht erzeugt werden: Relay ist nicht verbunden.', false);
      return;
    }
    setResult('previewResult', 'Gelber Messkegel wird am Spawnpunkt erzeugt …');
  }

  function beginPreviewTeardown(kind, payload = null) {
    const commandId = sendStabilizerCommand('homebase_v1.preview.extras.clear');
    if (!commandId) return false;
    previewTeardown = { commandId, kind, payload };
    clearTimeout(previewWatchdog);
    previewWatchdog = setTimeout(() => {
      if (previewTeardown?.commandId !== commandId) return;
      previewTeardown = null;
      setResult('previewResult', 'Zeitüberschreitung beim bestätigten Abbau der Zusatzobjekte.', false);
      previewQueued = false;
      clearQueued = false;
    }, 90000);
    return true;
  }

  function finishPrimaryTeardownIfReady() {
    if (!primaryTeardown) return;
    if (!primaryTeardown.trackerAck || !primaryTeardown.observerAck) return;
    const trackerFailed = primaryTeardown.trackerAck && primaryTeardown.trackerAck.status !== 'ok';
    const observerFailed = primaryTeardown.observerAck && primaryTeardown.observerAck.status !== 'ok';
    if (trackerFailed || observerFailed) {
      const failedObjects = primaryTeardown.observerAck?.failedObjects || [];
      const detail = failedObjects.length ? ` Nicht bestätigt: ${failedObjects.map((item) => item.label || item.title || item.objectId).join(', ')}.` : '';
      primaryTeardown = null;
      previewInFlightId = null;
      clearTimeout(previewWatchdog);
      previewWatchdog = null;
      previewQueued = false;
      clearQueued = false;
      setResult('previewResult', `Der Hangar-Abbau wurde gestoppt.${detail}`, false);
      return;
    }
    const transition = primaryTeardown;
    primaryTeardown = null;
    previewInFlightId = null;
    clearTimeout(previewWatchdog);
    previewWatchdog = null;
    if (transition.kind === 'set') {
      dispatchPreview(transition.payload);
    } else {
      setResult('previewResult', 'Zusatzobjekte und Hangar wurden bestätigt entfernt.', true);
      releasePreviewQueue();
    }
  }

  function beginPrimaryTeardown(transition) {
    const id = sendCommand('homebase_v1.preview.clear');
    if (!id) {
      previewQueued = false;
      clearQueued = false;
      setResult('previewResult', 'Tracker-Clear konnte nicht gesendet werden.', false);
      return false;
    }
    primaryTeardown = { ...transition, commandId: id, trackerAck: null, observerAck: null };
    previewInFlightId = id;
    previewWaitsForExtras = false;
    clearTimeout(previewWatchdog);
    previewWatchdog = setTimeout(() => {
      if (primaryTeardown?.commandId !== id) return;
      abandonedPrimaryCommandIds.add(id);
      setTimeout(() => abandonedPrimaryCommandIds.delete(id), 60000);
      primaryTeardown = null;
      previewInFlightId = null;
      previewQueued = false;
      clearQueued = false;
      setResult('previewResult', 'Zeitüberschreitung beim bestätigten Hangar-Abbau.', false);
    }, 35000);
    setResult('previewResult', 'Zusatzobjekte entfernt; warte auf ObjectRemoved für den Hangar …');
    return true;
  }

  function dispatchPreview(payload) {
    const id = `hb-direct-${Date.now()}-${++commandSeq}`;
    const hangarTitle = payload.trackerConfig.hangar.objectTitle;
    const hangar = {
      id: 'hangar', title: hangarTitle,
      label: hangarTitle === OPEN_PARKING_TITLE ? 'Offener Parkbereich' : 'Homebase-Hangar',
      ...payload.trackerConfig.hangar
    };
    previewInFlightId = id;
    previewWaitsForExtras = true;
    clearTimeout(previewWatchdog);
    previewWatchdog = setTimeout(() => finishPreviewRequest(id), 75000);
    const sent = sendStabilizerCommand('homebase_v1.preview.extras.set_standalone', {
      parentCommandId: id,
      objects: [hangar, ...payload.companionObjects]
    });
    if (!sent) {
      finishPreviewRequest(id);
      setResult('previewResult', 'Das gewählte Vorschaumodell konnte nicht an den Simulator gesendet werden.', false);
      return;
    }
    const persistentNote = payload.persistentObjects.length ? ` ${payload.persistentObjects.length} Paketobjekt(e) werden in der Live-Vorschau ausgelassen.` : '';
    setResult('previewResult', `${hangar.label} und ${state.objects.length - payload.persistentObjects.length} Objekte werden im Simulator aktualisiert …${persistentNote}`);
  }

  function sendPreview() {
    if (previewInFlightId || previewTeardown || primaryTeardown) {
      previewQueued = true;
      clearQueued = false;
      setResult('previewResult', 'Eine Vorschau wird gerade aufgebaut; die neueste Änderung ist vorgemerkt.');
      return;
    }
    invalidateLivePreview();
    const fullConfig = buildConfig();
    const companionObjects = fullConfig.objects.filter((item) => COMPANION_TITLES.has(item.title));
    const persistentObjects = fullConfig.objects.filter((item) => PERSISTENT_ONLY_TITLES.has(item.title));
    const trackerConfig = { ...fullConfig, objects: fullConfig.objects.filter((item) => !COMPANION_TITLES.has(item.title) && !PERSISTENT_ONLY_TITLES.has(item.title)) };
    previewQueued = false;
    if (beginPreviewTeardown('set', { trackerConfig, companionObjects, persistentObjects })) {
      setResult('previewResult', 'Vorhandene Zusatzobjekte werden bestätigt und nacheinander abgebaut …');
    }
  }

  function releasePreviewQueue() {
    if (clearQueued) {
      clearQueued = false;
      previewQueued = false;
      setTimeout(clearPreview, 250);
    } else if (previewQueued) {
      previewQueued = false;
      setTimeout(sendPreview, 250);
    }
  }

  function finishPreviewRequest(commandId) {
    if (!previewInFlightId || (commandId && commandId !== previewInFlightId)) return;
    previewInFlightId = null;
    previewWaitsForExtras = false;
    clearTimeout(previewWatchdog);
    previewWatchdog = null;
    if (spawnProbeEnabled) setTimeout(requestSpawnProbeMove, 700);
    releasePreviewQueue();
  }

  function clearPreview() {
    spawnProbeEnabled = false;
    invalidateLivePreview();
    if (previewInFlightId || previewTeardown || primaryTeardown) {
      clearQueued = true;
      previewQueued = false;
      setResult('previewResult', 'Entfernen ist vorgemerkt und beginnt nach dem laufenden Vorschauauftrag.');
      return;
    }
    if (beginPreviewTeardown('clear')) setResult('previewResult', 'Zusatzobjekte werden bestätigt und nacheinander entfernt …');
  }

  async function refreshLocalAssetInspection(options = {}) {
    try {
      if (INTEGRATED) {
        const remote = options.remote === true;
        const result = remote
          ? await postJson('/api/assets/update-check', { force: options.force === true })
          : await requestJson('/api/assets/inspection', { cache: 'no-store' });
        localAssetInspection = result;
      } else {
        const response = await fetch('/api/assets/inspection', { cache: 'no-store' });
        if (response.ok) localAssetInspection = await response.json();
      }
    } catch (_) {
      localAssetInspection = null;
    }
    if (localAssetInspection) {
      const installedCatalog = Array.isArray(localAssetInspection.assetCatalog) ? localAssetInspection.assetCatalog : [];
      const remoteMatchesInstalled = localAssetInspection.packageComplete === true
        && String(localAssetInspection.packageVersion || '') === String(localAssetInspection.remoteVersion || '');
      mergeRuntimeAssetCatalog(installedCatalog.length
        ? installedCatalog
        : (remoteMatchesInstalled && Array.isArray(localAssetInspection.remoteAssets) ? localAssetInspection.remoteAssets : []));
    }
    renderAssetInspection();
    return localAssetInspection;
  }

  function renderAssetInspection() {
    if (!localAssetInspection) {
      setResult('assetPackageResult', 'Assetpaket-Status ist noch nicht verfügbar.', null);
      return;
    }
    if (localAssetInspection.updateAvailable) {
      const installed = localAssetInspection.packageComplete
        ? `Installiert: ${localAssetInspection.packageVersion}.`
        : 'Es ist kein vollständiges Assetpaket installiert.';
      const sizeMb = Number(localAssetInspection.remoteArchiveSize || 0) / 1024 / 1024;
      const size = sizeMb > 0 ? ` Download: ${sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} MB.` : '';
      setResult('assetPackageResult', `${installed} Serverversion ${localAssetInspection.remoteVersion} ist verfügbar.${size}`, false);
      $('assetPackageBtn').textContent = `Assetpaket auf ${localAssetInspection.remoteVersion} aktualisieren`;
      return;
    }
    if (localAssetInspection.packageComplete) {
      const community = localAssetInspection.communityPath
        ? ` Community-Ordner: ${localAssetInspection.communityPath}.`
        : '';
      const remote = localAssetInspection.remoteAvailable
        ? ` Der geprüfte Serverstand ist ${localAssetInspection.remoteVersion}.`
        : localAssetInspection.remoteError
          ? ` Serverprüfung derzeit nicht möglich: ${localAssetInspection.remoteError}`
          : '';
      setResult('assetPackageResult', `Homebase-Assetpaket ${localAssetInspection.packageVersion} ist installiert und vollständig.${community}${remote}`, true);
      $('assetPackageBtn').textContent = 'Assetpaket erneut prüfen';
      return;
    }
    const found = localAssetInspection.communityFound
      ? `Installiert ist ${localAssetInspection.packageVersion || 'eine unvollständige Version'}.`
      : 'Es ist noch kein Homebase-Assetpaket installiert.';
    const fallback = localAssetInspection.embeddedPackageComplete
      ? ` Der Tracker enthält Version ${localAssetInspection.embeddedPackageVersion} zur sicheren Installation.`
      : ' Der Tracker enthält kein verwendbares Offline-Paket.';
    const detection = localAssetInspection.communityDetectionError
      ? ` ${localAssetInspection.communityDetectionError}`
      : '';
    setResult('assetPackageResult', `${found}${fallback}${detection}`, false);
    $('assetPackageBtn').textContent = 'Assetpaket prüfen oder installieren';
  }

  async function offerAssetPackageInstall(options = {}) {
    const force = options.force === true;
    if (!INTEGRATED) {
      await refreshLocalAssetInspection();
      log('Die automatische Assetinstallation steht in der integrierten Haupt-App über den PC-Tracker ab v288 bereit.');
      return;
    }
    if (assetInstallCheckInFlight) return;
    assetInstallCheckInFlight = true;
    const button = $('assetPackageBtn');
    button.disabled = true;
    try {
      const inspection = await refreshLocalAssetInspection({ remote: true, force });
      if (!inspection) throw new Error('Der Assetpaket-Status konnte nicht vom Tracker gelesen werden.');
      if (inspection.packageComplete && !inspection.updateAvailable) {
        if (force) log(`Homebase-Assetpaket ${inspection.packageVersion} ist bereits aktuell.`, 'ok');
        if (force && inspection.remoteError) log(`Remote-Prüfung nicht möglich; installierte Version bleibt unverändert: ${inspection.remoteError}`, 'error');
        return;
      }
      const useRemote = inspection.remoteAvailable === true && inspection.updateAvailable === true;
      if (!useRemote && (!inspection.embeddedAvailable || !inspection.embeddedPackageComplete)) {
        throw new Error(`Der Tracker enthält kein gültiges Offline-Assetpaket ${inspection.expectedPackageVersion || ''}.`);
      }
      const availableVersion = useRemote ? inspection.remoteVersion : inspection.embeddedPackageVersion;
      const signature = `${inspection.packageVersion || 'missing'}>${useRemote ? 'remote' : 'embedded'}:${availableVersion}`;
      if (!force && assetPromptedSignature === signature) return;
      assetPromptedSignature = signature;
      const current = inspection.communityFound
        ? `Installierte Version: ${inspection.packageVersion || 'unvollständig'}`
        : 'Noch keine Version installiert';
      const sizeMb = Number(inspection.remoteArchiveSize || 0) / 1024 / 1024;
      const changed = Array.isArray(inspection.changedAssets) && inspection.changedAssets.length
        ? `\nGeänderte Assets: ${inspection.changedAssets.join(', ')}`
        : '';
      const source = useRemote
        ? `Verfügbar auf dem Assetserver: ${availableVersion}\nDownloadgröße: ${sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} MB${changed}`
        : `Offline im Tracker verfügbar: ${availableVersion}`;
      const confirmed = window.confirm(
        `Das Homebase-Assetpaket fehlt oder ist veraltet.\n\n${current}\n${source}\n\n` +
        'Soll das geprüfte Paket jetzt in den aktiven MSFS-Community-Ordner installiert werden? Download, Prüfsummen und Paketinhalt werden vor dem Austausch vollständig kontrolliert.'
      );
      if (!confirmed) {
        log('Installation des Homebase-Assetpakets durch den Benutzer pausiert.');
        return;
      }
      const simulator = await requestJson('/api/simulator/status');
      if (simulator.running) {
        const stopConfirmed = window.confirm(
          'MSFS läuft noch. Damit das Assetpaket sicher ersetzt und beim nächsten Start geladen wird, muss der Simulator geschlossen werden.\n\n' +
          'Nicht gespeicherter Flugfortschritt kann verloren gehen. MSFS jetzt schließen und das Assetpaket installieren?'
        );
        if (!stopConfirmed) {
          log('Assetinstallation pausiert; MSFS wurde nicht beendet.');
          return;
        }
        await postJson('/api/simulator/stop', { confirmed: true });
        log('MSFS wurde nach Bestätigung für die Assetinstallation geschlossen.', 'ok');
      }
      setResult('assetPackageResult', useRemote
        ? `Assetpaket ${availableVersion} wird heruntergeladen, geprüft und atomar installiert …`
        : `Offline-Assetpaket ${availableVersion} wird geprüft und atomar installiert …`);
      const installed = useRemote
        ? await postJson('/api/assets/update-install', { confirmed: true })
        : await postJson('/api/assets/install', { confirmed: true });
      await refreshLocalAssetInspection({ remote: true });
      log(installed.message || `Homebase-Assetpaket ${installed.packageVersion || ''} installiert.`, 'ok');
      const installPath = installed.communityPath ? ` Ziel: ${installed.communityPath}.` : '';
      setResult('assetPackageResult', `${installed.message || 'Homebase-Assetpaket installiert.'}${installPath} MSFS anschließend neu starten.`, true);
    } catch (error) {
      setResult('assetPackageResult', `Assetpaket konnte nicht installiert werden: ${error?.message || error}`, false);
      log(`Assetpaket-Installation: ${error?.message || error}`, 'error');
    } finally {
      button.disabled = false;
      assetInstallCheckInFlight = false;
    }
  }

  const BUILD_STEPS = ['project', 'simulator', 'sdk', 'install', 'done'];

  function showBuildStage(step, message, stateName = 'active') {
    const activeIndex = BUILD_STEPS.indexOf(step);
    document.querySelectorAll('[data-build-step]').forEach((item) => {
      const index = BUILD_STEPS.indexOf(item.dataset.buildStep);
      item.classList.remove('active', 'done', 'failed');
      if (index < activeIndex || stateName === 'complete') item.classList.add('done');
      else if (index === activeIndex) item.classList.add(stateName === 'failed' ? 'failed' : 'active');
    });
    const progress = stateName === 'complete' ? 100 : Math.max(5, ((activeIndex + (stateName === 'failed' ? 0 : .35)) / BUILD_STEPS.length) * 100);
    $('buildProgressBar').style.width = `${progress}%`;
    setResult('packageResult', message, stateName === 'complete' ? true : stateName === 'failed' ? false : null);
  }

  async function requestJson(pathname, options = {}) {
    if (INTEGRATED) {
      const requestId = `homebase-rpc-${Date.now()}-${++integratedRpcSeq}`;
      let body = {};
      try { body = options?.body ? JSON.parse(options.body) : {}; } catch (_) {}
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          integratedRpcPending.delete(requestId);
          reject(new Error(`Zeitüberschreitung bei ${pathname}.`));
        }, ['/api/package/build', '/api/assets/update-install'].includes(pathname) ? 180000 : 30000);
        integratedRpcPending.set(requestId, { resolve, reject, timer });
        window.parent.postMessage({
          channel: 'vfr-homebase',
          kind: 'rpc',
          requestId,
          pathname,
          method: options?.method || 'GET',
          body
        }, PARENT_ORIGIN);
      });
    }
    const response = await fetch(pathname, options);
    let result;
    try { result = await response.json(); } catch (_) { result = {}; }
    if (!response.ok || result.ok === false) {
      const error = new Error(result.error || `Die Workbench meldet HTTP ${response.status}.`);
      error.code = result.code || '';
      error.help = result.help || '';
      throw error;
    }
    return result;
  }

  function postJson(pathname, body = {}) {
    return requestJson(pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function buildAirportGuided() {
    const button = $('buildAirportBtn');
    button.disabled = true;
    $('sdkHelp').open = false;
    try {
      showBuildStage('project', 'Schritt 1 von 5: Das Homebase-Projekt wird aus deiner aktuellen Szene erstellt …');
      const prepared = await postJson('/api/package/prepare', { config: buildConfig() });
      log(prepared.message || 'Homebase-Projekt erstellt.', 'ok');

      const sdk = await requestJson('/api/sdk/status');
      if (!sdk.installed) {
        const error = new Error('Das MSFS 2024 SDK wurde nicht gefunden. Öffne die Anleitung unten, installiere das SDK und starte diesen Schritt danach erneut.');
        error.code = 'SDK_MISSING';
        throw error;
      }

      showBuildStage('simulator', 'Projekt erstellt. Prüfe jetzt, ob MSFS für den Paketbau geschlossen werden muss …');
      const simulator = await requestJson('/api/simulator/status');
      if (simulator.running) {
        const confirmed = window.confirm('Das Homebase-Projekt wurde erstellt.\n\nFür den offiziellen Paketbau muss MSFS jetzt beendet werden. Nicht gespeicherter Flugfortschritt kann dabei verloren gehen.\n\nMSFS jetzt schließen und mit dem Bau fortfahren?');
        if (!confirmed) {
          showBuildStage('simulator', 'Pausiert: MSFS wurde nicht beendet. Das Projekt ist gespeichert; du kannst den Bau später erneut starten.');
          log('Flugplatzbau vor dem Beenden von MSFS durch den Benutzer pausiert.');
          return;
        }
        showBuildStage('simulator', 'MSFS wird geschlossen. Bitte einen Moment warten …');
        const stopping = await postJson('/api/simulator/stop', { confirmed: true });
        log(stopping.message || 'Das Beenden von MSFS wurde angefordert.', 'ok');
      } else {
        log('MSFS war bereits geschlossen.', 'ok');
      }

      showBuildStage('sdk', 'Schritt 3 von 5: Der Tracker wartet bei Bedarf auf das vollständige Beenden von MSFS und startet danach das offizielle Package Tool …');
      const built = await postJson('/api/package/build', { config: buildConfig() });
      const waited = Number(built.simulatorExit?.waitedMs || 0);
      log(`${built.message || 'Homebase-Paket gebaut.'}${waited > 0 ? ` Nach ${Math.round(waited / 1000)} Sekunde(n) Wartezeit auf MSFS.` : ''}`, 'ok');

      showBuildStage('install', 'Das Flugplatzpaket wurde gebaut und ist bereit zur Installation.');
      const installConfirmed = window.confirm('Der Flugplatz wurde erfolgreich gebaut.\n\nSoll er jetzt sauber in den aktiven MSFS-Community-Ordner installiert werden? Eine ältere Homebase-Version wird dabei ersetzt.');
      if (!installConfirmed) {
        showBuildStage('install', 'Pausiert: Das fertige Paket wurde noch nicht installiert. Du kannst den Bauassistenten später erneut starten.');
        log('Installation des gebauten Homebase-Pakets durch den Benutzer pausiert.');
        return;
      }

      showBuildStage('install', 'Das alte Homebase-Paket wird entfernt und die neue Version in den Community-Ordner installiert …');
      const installed = await postJson('/api/package/install', { confirmed: true });
      log(installed.message || 'Homebase-Mod installiert.', 'ok');
      showBuildStage('done', 'Fertig: Homebase wurde installiert. Starte MSFS neu, damit der Flugplatz geladen wird.', 'complete');
    } catch (error) {
      const active = document.querySelector('[data-build-step].active')?.dataset.buildStep || 'project';
      showBuildStage(active, `Der Bau wurde gestoppt: ${error?.message || error}`, 'failed');
      if (error?.code === 'SDK_MISSING' || String(error?.message || '').toLowerCase().includes('package tool')) $('sdkHelp').open = true;
      log(`Flugplatzbau: ${error?.message || error}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function uninstallAirport() {
    const confirmed = window.confirm(
      'Soll der installierte Flugplatz „Homebase“ wirklich aus dem MSFS-Community-Ordner gelöscht werden?\n\n' +
      'Das gemeinsame Assetpaket, die Workbench und dein gespeicherter Entwurf bleiben erhalten. ' +
      'Damit die Änderung im Simulator wirksam wird, muss MSFS anschließend neu gestartet werden.'
    );
    if (!confirmed) {
      log('Homebase-Deinstallation wurde abgebrochen.');
      return;
    }
    const button = $('uninstallAirportBtn');
    button.disabled = true;
    setResult('packageResult', 'Homebase wird aus dem Community-Ordner entfernt …');
    try {
      const result = await postJson('/api/package/uninstall', { confirmed: true });
      setResult('packageResult', result.message || 'Homebase wurde deinstalliert.', true);
      log(result.message || 'Homebase wurde deinstalliert.', 'ok');
    } catch (error) {
      setResult('packageResult', `Homebase konnte nicht deinstalliert werden: ${error?.message || error}`, false);
      log(`Homebase-Deinstallation: ${error?.message || error}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function connect() {
    clearTimeout(reconnectTimer);
    if (socket) {
      socket.onclose = null;
      try { socket.close(); } catch (_) {}
    }
    if (INTEGRATED) {
      setPill('relayPill', 'Haupt-App verbindet …', 'warn');
      socket = {
        readyState: WebSocket.OPEN,
        send(raw) {
          let payload = null;
          try { payload = JSON.parse(String(raw || '')); } catch (_) { return; }
          if (payload?.type === 'join') return;
          window.parent.postMessage({ channel: 'vfr-homebase', kind: 'relay-command', payload }, PARENT_ORIGIN);
        },
        close() {}
      };
      if (!integratedMessageBound) {
        integratedMessageBound = true;
        window.addEventListener('message', (event) => {
          if (event.origin !== PARENT_ORIGIN || event.source !== window.parent) return;
          const message = event.data;
          if (!message || message.channel !== 'vfr-homebase') return;
          if (message.kind === 'environment-opened') {
            environmentOpened = true;
            offerAssetPackageInstall().catch(() => {});
            return;
          }
          if (message.kind === 'sync-status') {
            setPill('syncPill', message.text || 'Cloud-Sync', message.status || 'muted');
            return;
          }
          if (message.kind === 'sync-load-result') {
            if (message.disabled) {
              setPill('syncPill', 'Nur lokal gespeichert', 'muted');
              return;
            }
            if (!message.ok) {
              setPill('syncPill', 'Cloud nicht erreichbar', 'bad');
              if (message.error) log(`Homebase-Synchronisation: ${message.error}`, 'error');
              return;
            }
            if (message.record) resolveCloudConflict(message.record, 'load');
            else if (syncMeta.dirty) {
              postSyncDraft();
              setPill('syncPill', 'Cloud bereit – lokal geändert', 'warn');
            } else {
              setPill('syncPill', 'Cloud bereit', 'ok');
            }
            return;
          }
          if (message.kind === 'sync-save-result') {
            if (message.conflict && message.record) {
              resolveCloudConflict(message.record, 'save');
              return;
            }
            if (!message.ok) {
              setPill('syncPill', 'Cloud-Speichern fehlgeschlagen', 'bad');
              if (message.error) log(`Homebase-Synchronisation: ${message.error}`, 'error');
              return;
            }
            const record = message.record || {};
            syncMeta.baseRevision = String(record.revision || syncMeta.baseRevision || '');
            syncMeta.cloudUpdatedAt = finite(record.updatedAt, Date.now());
            if (syncMeta.localUpdatedAt <= finite(record.clientUpdatedAt, syncMeta.localUpdatedAt)) syncMeta.dirty = false;
            persistSyncMeta();
            postSyncDraft();
            setPill('syncPill', syncMeta.dirty ? 'Weitere Änderung wartet' : 'Homebase synchronisiert', syncMeta.dirty ? 'warn' : 'ok');
            return;
          }
          if (message.kind === 'rpc-result') {
            const pending = integratedRpcPending.get(String(message.requestId || ''));
            if (!pending) return;
            integratedRpcPending.delete(String(message.requestId || ''));
            clearTimeout(pending.timer);
            if (message.ok === false) {
              const error = new Error(message.error || 'Homebase-Auftrag fehlgeschlagen.');
              error.code = message.code || '';
              error.help = message.help || '';
              pending.reject(error);
            } else {
              pending.resolve(message.result || {});
            }
            return;
          }
          if (message.kind === 'asset-update') {
            const update = message.update || {};
            if (update.status === 'progress') {
              setResult('assetPackageResult', update.message || 'Asset-Update wird verarbeitet …');
              return;
            }
            localAssetInspection = { ...(localAssetInspection || {}), ...update };
            const installedCatalog = Array.isArray(localAssetInspection.assetCatalog) ? localAssetInspection.assetCatalog : [];
            const remoteMatchesInstalled = localAssetInspection.packageComplete === true
              && String(localAssetInspection.packageVersion || '') === String(localAssetInspection.remoteVersion || '');
            mergeRuntimeAssetCatalog(installedCatalog.length
              ? installedCatalog
              : (remoteMatchesInstalled && Array.isArray(localAssetInspection.remoteAssets) ? localAssetInspection.remoteAssets : []));
            renderAssetInspection();
            return;
          }
          if (message.kind === 'relay-message' && socket?.onmessage) {
            socket.onmessage({ data: JSON.stringify(message.payload || {}) });
          }
        });
      }
    } else {
      setPill('relayPill', 'Relay wecken …', 'warn');
      try { await fetch('https://websocketrelais.onrender.com/', { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(8000) }); } catch (_) {}
      setPill('relayPill', 'Relay verbindet …', 'warn');
      socket = new WebSocket(RELAY_URL);
    }
    socket.onopen = () => {
      setPill('relayPill', INTEGRATED ? 'Haupt-App verbunden' : 'Relay verbunden', 'ok');
      if (!INTEGRATED && (!STANDALONE_ID || !STANDALONE_PIN)) {
        setPill('relayPill', 'Nur über Haupt-App', 'warn');
        log('Standalone-Verbindung benötigt ?syncId=…&pin=…. In der Haupt-App werden die Pilot-Zugangsdaten automatisch verwendet.', 'error');
        return;
      }
      socket.send(JSON.stringify({ type: 'join', syncId: STANDALONE_ID, pin: STANDALONE_PIN }));
      log(INTEGRATED ? 'Mit der VFR-Multitool-Haupt-App verbunden.' : 'Mit dem VFR-Multitool-Relay verbunden.', 'ok');
      setTimeout(() => sendCommand('homebase_v1.capabilities'), 150);
    };
    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      if (data.type === 'error') { log(data.message || 'Relay-Fehler', 'error'); return; }
      if (data.trackerCommand || data.commandOnly) return;
      if (data.homebaseHello) {
        trackerLastSeen = Date.now();
        const caps = Array.isArray(data.homebaseHello.capabilities) ? data.homebaseHello.capabilities : [];
        const helloSignature = `${data.homebaseHello.version || ''}|${Boolean(data.homebaseHello.simConnected)}|${caps.join(',')}`;
        setPill('trackerPill', `Homebase-Tracker ${data.homebaseHello.version || 'bereit'}`, 'ok');
        setPill('simPill', data.homebaseHello.simConnected ? 'MSFS verbunden' : 'MSFS wartet', data.homebaseHello.simConnected ? 'ok' : 'warn');
        if (helloSignature !== connect.lastHelloSignature) {
          connect.lastHelloSignature = helloSignature;
          log(`Homebase-Tracker erkannt: ${caps.join(', ')}`, 'ok');
        }
        if (environmentOpened) offerAssetPackageInstall().catch(() => {});
      }
      if (data.trackerAck && String(data.trackerAck.type || '').startsWith('homebase_v1.')) {
        trackerLastSeen = Date.now(); handleAck(data.trackerAck);
      }
      if (data.stabilizerAck?.type === 'homebase_v1.preview.extras.clear_ack') {
        const ack = data.stabilizerAck;
        if (previewTeardown?.commandId === ack.commandId) {
          const transition = previewTeardown;
          previewTeardown = null;
          clearTimeout(previewWatchdog);
          previewWatchdog = null;
          const failed = Array.isArray(ack.failedObjects) && ack.failedObjects.length
            ? ` Nicht entfernt: ${ack.failedObjects.map((item) => item.label || item.title || item.objectId).join(', ')}.`
            : '';
          if (ack.status !== 'ok' || failed) {
            previewQueued = false;
            clearQueued = false;
            setResult('previewResult', `Der bestätigte Abbau wurde gestoppt.${failed || ' Mindestens ein Objekt wurde nicht bestätigt entfernt.'}`, false);
          } else {
            beginPrimaryTeardown(transition);
          }
        }
      }
      if (data.stabilizerAck?.type === 'homebase_v1.preview.primary.clear_ack') {
        const ack = data.stabilizerAck;
        if (primaryTeardown?.commandId === ack.commandId) {
          primaryTeardown.observerAck = ack;
          finishPrimaryTeardownIfReady();
          if (ack.status === 'ok' && Number(ack.removedCount || 0) === 0 && !primaryTeardown?.trackerAck) {
            const commandId = ack.commandId;
            setTimeout(() => {
              if (primaryTeardown?.commandId !== commandId || primaryTeardown.trackerAck) return;
              primaryTeardown.trackerAck = {
                type: 'homebase_v1.preview.clear_ack', commandId, status: 'ok',
                message: 'Kein live erzeugter Tracker-Hangar war registriert.'
              };
              log('Tracker-Clear ohne ACK: bestätigten Null-Abbau des Stabilizers übernommen.', 'ok');
              finishPrimaryTeardownIfReady();
            }, 1500);
          }
        }
      }
      if (data.stabilizerAck?.type === 'homebase_v1.preview.extras.set_ack') {
        const ack = data.stabilizerAck;
        finishPreviewRequest(ack.parentCommandId);
        const failed = Array.isArray(ack.failedObjects) && ack.failedObjects.length ? ` Nicht erzeugt: ${ack.failedObjects.map((item) => item.label || item.title).join(', ')}.` : '';
        livePreviewReady = ack.status === 'ok' && !failed;
        if (livePreviewReady) {
          liveObjectIds.clear();
          for (const item of state.objects) if (!PERSISTENT_ONLY_TITLES.has(item.title)) liveObjectIds.add(item.id);
        }
        setResult('previewResult', `Vorschau gesetzt. ${ack.extraCount || 0} Zusatzobjekte aktiv.${failed}`, livePreviewReady);
      }
      if (data.stabilizerAck?.type === 'homebase_v1.preview.object.add_ack') {
        const ack = data.stabilizerAck;
        const ok = ack.status === 'ok';
        const spawned = Array.isArray(ack.spawnedObjects) ? ack.spawnedObjects[0] : null;
        if (spawned?.id === SPAWN_PROBE_ID) {
          if (ok) requestSpawnProbeMove();
          else {
            spawnProbeEnabled = false;
            setResult('previewResult', ack.message || 'Der gelbe Messkegel konnte nicht erzeugt werden.', false);
          }
          return;
        }
        if (ok && spawned?.id) liveObjectIds.add(spawned.id);
        setResult('previewResult', ack.message || (ok ? 'Objekt wurde direkt erzeugt.' : 'Objekt konnte nicht erzeugt werden.'), ok);
        log(`${ack.type}: ${ack.message || ack.status}`, ok ? 'ok' : 'error');
      }
      if (data.stabilizerAck?.type === 'homebase_v1.preview.object.remove_ack') {
        const ack = data.stabilizerAck;
        const ok = ack.status === 'ok' || ack.status === 'noop';
        if (ack.id) liveObjectIds.delete(ack.id);
        setResult('previewResult', ack.message || (ok ? 'Objekt wurde aus der Live-Vorschau entfernt.' : 'Objekt konnte nicht entfernt werden.'), ok);
        log(`${ack.type}: ${ack.message || ack.status}`, ok ? 'ok' : 'error');
      }
      if (['homebase_v1.preview.object.move_ack', 'homebase_v1.preview.hangar.move_ack'].includes(data.stabilizerAck?.type)) {
        const ack = data.stabilizerAck;
        const ok = ack.status === 'ok';
        if (ack.commandId === pendingProbeMoveCommandId) {
          pendingProbeMoveCommandId = null;
          if (!ok && String(ack.message || '').includes('nicht registriert')) {
            addSpawnProbe();
            return;
          }
          if (ok && Number.isFinite(Number(ack.groundAltitudeFt))) {
            state.spawn.altFt = Number(ack.groundAltitudeFt);
            // Die Messung aktualisiert nur die gespeicherte Bodenhöhe. Die bereits
            // erzeugten SimConnect-Objekte bleiben dabei gültig und beweglich.
            saveState(); syncInputsFromState(); updateMap();
            setResult('previewResult', `Messkegel steht am Spawnpunkt. Bodenhöhe: ${state.spawn.altFt.toFixed(1)} ft MSL.`, true);
            log(`Spawnpunkt-Bodenhöhe über Messkegel gelesen: ${state.spawn.altFt.toFixed(2)} ft MSL.`, 'ok');
          } else {
            setResult('previewResult', ack.message || 'Die Bodenhöhe am Messkegel konnte nicht gelesen werden.', false);
          }
          return;
        }
        const movedObject = pendingLiveObjectMoves.get(ack.commandId);
        pendingLiveObjectMoves.delete(ack.commandId);
        if (movedObject && !ok && String(ack.message || '').includes('nicht registriert')) {
          liveObjectIds.delete(movedObject.id);
          setResult('previewResult', `${movedObject.label || movedObject.title} wird gezielt wiederhergestellt und an der neuen Position platziert …`);
          sendLiveObjectAdd(movedObject);
          return;
        }
        if (movedObject && ok) liveObjectIds.add(movedObject.id);
        setResult('previewResult', ack.message || (ok ? 'Objekt wurde ohne neuen Spawn verschoben.' : 'Objekt konnte nicht verschoben werden.'), ok);
        log(`${ack.type}: ${ack.message || ack.status}`, ok ? 'ok' : 'error');
      }
      if (data.type === 'gps' && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lon))) {
        trackerLastSeen = Date.now();
        if (Number.isFinite(Number(data.groundAltitudeFt))) {
          lastGroundAltitude = { altFt: Number(data.groundAltitudeFt), receivedAt: Date.now() };
        }
        lastTelemetry = { lat: Number(data.lat), lon: Number(data.lon), altFt: finite(data.alt, 0), heading: normalizeHeading(data.hdg), flight: data.flight || {} };
        planeMarker.setLatLng([lastTelemetry.lat, lastTelemetry.lon]).setOpacity(1);
        setPill('trackerPill', `Homebase-Tracker ${data.trackerVersion || 'online'}`, 'ok');
        setPill('simPill', 'MSFS verbunden', 'ok');
        if (!centeredOnce) {
          centeredOnce = true;
          map.setView([lastTelemetry.lat, lastTelemetry.lon], 18);
          setResult('previewResult', 'Die gespeicherte Homebase wurde nicht automatisch als Live-Vorschau geladen. „Vorschau neu laden“ baut sie bei Bedarf vollständig auf.');
        }
      }
    };
    socket.onerror = () => setPill('relayPill', 'Relay-Fehler', 'bad');
    socket.onclose = () => {
      invalidateLivePreview();
      setPill('relayPill', INTEGRATED ? 'Haupt-App getrennt' : 'Relay getrennt', 'warn');
      setPill('trackerPill', 'Homebase-Tracker unbekannt', 'muted');
      if (!INTEGRATED) reconnectTimer = setTimeout(connect, 4000);
    };
    if (INTEGRATED) setTimeout(() => socket?.onopen?.(), 0);
  }

  function handleAck(ack) {
    const ok = ack.status === 'ok';
    const message = ack.message || ack.error || ack.status || 'Antwort empfangen';
    log(`${ack.type}: ${message}`, ok ? 'ok' : 'error');
    if (ack.type === 'homebase_v1.preview.set_ack') {
      if (!previewWaitsForExtras || !ok) finishPreviewRequest(ack.commandId);
      const failed = Array.isArray(ack.failedObjects) && ack.failedObjects.length ? ` Nicht erzeugt: ${ack.failedObjects.map((item) => item.label || item.title).join(', ')}.` : '';
      setResult('previewResult', `${message}${Number.isFinite(ack.objectCount) ? ` ${ack.objectCount} Ausstattungsobjekte aktiv.` : ''}${failed}`, ok && !failed);
    } else if (ack.type === 'homebase_v1.preview.clear_ack') {
      if (primaryTeardown?.commandId === ack.commandId) {
        primaryTeardown.trackerAck = ack;
        finishPrimaryTeardownIfReady();
      } else if (abandonedPrimaryCommandIds.has(ack.commandId)) {
        log(`${ack.type}: verspätetes ACK nach abgebrochener Hangar-Bestätigung ignoriert.`);
      } else {
        setResult('previewResult', message, ok);
        finishPreviewRequest(ack.commandId);
      }
    } else if (ack.type.startsWith('homebase_v1.package.')) {
      setResult('packageResult', `${message}${ack.path ? ` ${ack.path}` : ''}`, ok);
    }
  }

  spawnMarker.on('dragend', () => {
    const point = spawnMarker.getLatLng();
    state.spawn.lat = point.lat; state.spawn.lon = point.lng;
    saveState(); syncInputsFromState(); updateMap(); invalidateLivePreview();
  });
  hangarMarker.on('dragend', () => {
    const point = hangarMarker.getLatLng();
    const offset = localOffsetMeters(state.spawn.lat, state.spawn.lon, point.lat, point.lng);
    state.hangar.northM = offset.northM; state.hangar.eastM = offset.eastM;
    saveState(); syncInputsFromState(); updateMap(); scheduleLiveHangarMove();
  });

  ['spawnLat', 'spawnLon', 'spawnAlt', 'spawnHeading', 'spawnMode'].forEach((id) => {
    $(id).addEventListener('input', readSpawnStateFromInputs);
    $(id).addEventListener('change', readSpawnStateFromInputs);
  });
  ['hangarNorth', 'hangarEast', 'hangarHeading', 'hangarHeight', 'hangarWidth', 'hangarDepth'].forEach((id) => {
    $(id).addEventListener('input', readHangarStateFromInputs);
    $(id).addEventListener('change', readHangarStateFromInputs);
  });
  ['objectNorth', 'objectEast', 'objectHeading', 'objectHeight', 'objectScale'].forEach((id) => {
    $(id).addEventListener('input', readSelectedObjectFromInputs);
    $(id).addEventListener('change', readSelectedObjectFromInputs);
  });
  document.querySelectorAll('[data-nudge]').forEach((button) => button.addEventListener('click', () => {
    const step = finite($('nudgeStep').value, 1);
    if (button.dataset.nudge === 'north') state.hangar.northM += step;
    if (button.dataset.nudge === 'south') state.hangar.northM -= step;
    if (button.dataset.nudge === 'east') state.hangar.eastM += step;
    if (button.dataset.nudge === 'west') state.hangar.eastM -= step;
    saveState(); syncInputsFromState(); updateMap(); scheduleLiveHangarMove();
  }));
  document.querySelectorAll('[data-object-nudge]').forEach((button) => button.addEventListener('click', () => {
    const item = selectedObject();
    if (!item) return;
    const step = finite($('objectNudgeStep').value, .5);
    if (button.dataset.objectNudge === 'north') item.northM += step;
    if (button.dataset.objectNudge === 'south') item.northM -= step;
    if (button.dataset.objectNudge === 'east') item.eastM += step;
    if (button.dataset.objectNudge === 'west') item.eastM -= step;
    saveState(); syncInputsFromState(); updateMap(); scheduleLiveObjectMove(item);
  }));

  $('useAircraftBtn').addEventListener('click', () => {
    if (!lastTelemetry) { log('Noch keine MSFS-Telemetrie vorhanden.', 'error'); return; }
    state.spawn.lat = lastTelemetry.lat; state.spawn.lon = lastTelemetry.lon;
    state.spawn.heading = lastTelemetry.heading;
    state.hangar.heading = lastTelemetry.heading; state.hangar.northM = 0; state.hangar.eastM = 0;
    saveState(); syncInputsFromState(); updateMap(); map.setView([state.spawn.lat, state.spawn.lon], 19);
    invalidateLivePreview();
    log('Startpunkt auf die aktuelle Flugzeugposition und -ausrichtung gesetzt.', 'ok');
    setResult('previewResult', 'Startpunkt wurde auf die Flugzeugposition gesetzt.', true);
    requestSpawnProbeMove();
  });
  $('placeSpawnProbeBtn').addEventListener('click', requestSpawnProbeMove);
  $('placeHangarBtn').addEventListener('click', () => {
    state.hangar.northM = 0; state.hangar.eastM = 0;
    state.hangar.heading = state.spawn.heading;
    state.hangar.objectTitle = normalizeHangarTitle($('hangarSelect').value);
    saveState(); syncInputsFromState(); updateMap();
    log(`${$('hangarSelect').selectedOptions[0]?.textContent || 'Hangar'} wird am Startpunkt platziert.`);
    sendPreview();
  });
  $('hangarSelect').addEventListener('change', () => {
    state.hangar.objectTitle = normalizeHangarTitle($('hangarSelect').value);
    saveState(); syncInputsFromState(); updateMap();
    log(`${$('hangarSelect').selectedOptions[0]?.textContent || 'Vorschaumodell'} ausgewählt. Die Vorschau wird ersetzt.`);
    sendPreview();
  });
  $('addObjectBtn').addEventListener('click', () => addObject($('catalogSelect').value));
  $('duplicateObjectBtn').addEventListener('click', () => { const item = selectedObject(); if (item) addObject(item.title, item); });
  $('deleteObjectBtn').addEventListener('click', deleteSelectedObject);
  $('crewShareToggle').addEventListener('change', () => {
    syncMeta.crewShareEnabled = $('crewShareToggle').checked === true;
    syncMeta.dirty = true;
    syncMeta.localUpdatedAt = Date.now();
    persistSyncMeta();
    postSyncDraft();
    if (INTEGRATED) window.parent.postMessage({ channel: 'vfr-homebase', kind: 'sync-save-now', reason: 'crew-share-change' }, PARENT_ORIGIN);
    setPill('syncPill', syncMeta.crewShareEnabled ? 'Crew-Freigabe wird gespeichert' : 'Crew-Freigabe wird aufgehoben', 'warn');
  });
  $('previewBtn').addEventListener('click', sendPreview);
  $('clearBtn').addEventListener('click', clearPreview);
  $('buildAirportBtn').addEventListener('click', buildAirportGuided);
  $('assetPackageBtn').addEventListener('click', () => offerAssetPackageInstall({ force: true }));
  $('uninstallAirportBtn').addEventListener('click', uninstallAirport);
  $('connectBtn').addEventListener('click', connect);
  $('clearLogBtn').addEventListener('click', () => { $('log').textContent = ''; });
  fillCatalog(); syncInputsFromState(); updateMap(); refreshLocalAssetInspection(); connect();
  if (INTEGRATED) {
    postSyncDraft();
    window.parent.postMessage({ channel: 'vfr-homebase', kind: 'workbench-ready' }, PARENT_ORIGIN);
  }
  log(INTEGRATED ? 'Homebase Workbench v1.0.0 in der VFR-Multitool-Haupt-App gestartet.' : 'Homebase Workbench v1.0.0 im Standalone-Modus gestartet.');
})();
