(() => {
  'use strict';

  const RELAY_URL = 'wss://websocketrelais.onrender.com/';
  const URL_PARAMS = new URLSearchParams(window.location.search);
  const INTEGRATED = URL_PARAMS.get('integrated') === '1' && window.parent !== window;
  const STANDALONE_ID = String(URL_PARAMS.get('syncId') || '').trim();
  const STANDALONE_PIN = String(URL_PARAMS.get('pin') || '').trim();
  const PARENT_ORIGIN = window.location.origin;

  function applyWorkbenchTheme(value) {
    const raw = String(value || '').trim().toLowerCase();
    const theme = raw === 'win31' ? 'win95' : (['classic', 'retro', 'navcom', 'ops1940', 'win95'].includes(raw) ? raw : 'classic');
    document.documentElement.dataset.theme = theme;
    return theme;
  }

  applyWorkbenchTheme(document.documentElement.dataset.theme || localStorage.getItem('ga_theme'));
  const STORAGE_KEY = 'vfr-homebase-workbench-v2';
  const SYNC_META_KEY = 'vfr-homebase-workbench-sync-v1';
  const DEVICE_ID_KEY = 'vfr-homebase-device-id';
  const COMPILE_MODE_KEY = 'vfr-homebase-compile-mode-v1';
  const ASSET_CATALOG = globalThis.HOMEBASE_ASSET_CATALOG;
  if (!ASSET_CATALOG?.assets?.length) throw new Error('Der gemeinsame Homebase-Assetkatalog wurde nicht geladen.');
  const ROUTE_CORE = globalThis.HOMEBASE_ROUTE_CORE;
  if (!ROUTE_CORE?.planRouteToObject) throw new Error('Der Homebase-Routenplaner wurde nicht geladen.');
  const ASSET_BY_KEY = new Map(ASSET_CATALOG.assets.map((entry) => [entry.key, entry]));
  const ASSET_DEFINITIONS = new Map([
    ...ASSET_CATALOG.assets.map((entry) => [entry.title, { ...entry }]),
    ...ASSET_CATALOG.stockObjects.map((entry) => [entry.title, { ...entry }])
  ]);
  const TARMAC_PEOPLE = Array.isArray(ASSET_CATALOG.tarmacPeople) ? ASSET_CATALOG.tarmacPeople : [];
  const TARMAC_PERSON_TITLE_ALIASES = ASSET_CATALOG.legacyPersonTitleAliases || {};
  const HANGAR_TITLE = ASSET_BY_KEY.get('hangar').title;
  const OPEN_PARKING_TITLE = ASSET_BY_KEY.get('openParking').title;
  const HANGAR_DEFINITIONS = new Map(ASSET_CATALOG.assets
    .filter((entry) => entry.kind === 'hangar')
    .map((entry) => [entry.title, entry]));
  const HANGAR_TITLES = new Set(ASSET_CATALOG.assets
    .filter((entry) => entry.kind === 'hangar' && entry.workbenchVisible !== false)
    .map((entry) => entry.title));
  const SPAWN_PROBE_ID = '__homebase_spawn_probe__';
  const SPAWN_PROBE_TITLE = ASSET_BY_KEY.get('spawnProbe').title;
  const OBJECT_CATALOG = [
    ...ASSET_CATALOG.stockObjects.filter((entry) => entry.workbenchVisible !== false).map((entry) => ({ ...entry })),
    ...ASSET_CATALOG.assets.filter((entry) => (entry.kind === 'object' || entry.kind === 'hangar') && entry.workbenchVisible !== false && entry.homebasePlaceable !== false).map((entry) => ({ ...entry, companion: true }))
  ];
  const CATALOG_BY_TITLE = new Map(OBJECT_CATALOG.map((entry) => [entry.title, entry]));
  const LEGACY_TITLE_ALIASES = new Map(Object.entries(ASSET_CATALOG.legacyTitleAliases || {}));
  const COMPANION_TITLES = new Set(OBJECT_CATALOG.filter((entry) => !entry.persistentOnly).map((entry) => entry.title));
  const PERSISTENT_ONLY_TITLES = new Set(OBJECT_CATALOG.filter((entry) => entry.persistentOnly).map((entry) => entry.title));
  const DEFAULT = {
    doorAutomationEnabled: true,
    spawn: { lat: 48.1504, lon: 7.7099, altFt: 620, heading: 90, mode: 'airport_parking' },
    hangar: { northM: 0, eastM: 0, heading: 90, heightFt: 0, widthM: 18, depthM: 22, objectTitle: HANGAR_TITLE },
    objects: [],
    people: [],
    controlStates: []
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
  let personSeq = state.people.length;
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
  let selectedPersonId = state.people[0]?.id || null;
  let routeDebugEnabled = false;
  let routeDebugStart = { northM: 12, eastM: 0 };
  let routeDebugResult = null;
  let routeDebugLastAircraft = null;
  let localAssetInspection = null;
  let assetInstallCheckInFlight = false;
  let assetPromptedSignature = '';
  let environmentOpened = !INTEGRATED;
  let livePreviewReady = false;
  const liveMoveTimers = new Map();
  const liveObjectIds = new Set();
  const pendingLiveObjectMoves = new Map();
  const pendingControlCommands = new Map();
  const handledControlAckIds = new Set();
  const acknowledgedControlStates = new Map();
  const globalControlOperations = new Map();
  const controlCategoryOpenState = new Map([
    ['global', true],
    ['buildings', true],
    ['lighting', true],
    ['other', true]
  ]);
  let globalControlSequence = 0;
  let controlReapplyTimer = null;
  let peopleLiveSyncTimer = null;
  const integratedRpcPending = new Map();
  let integratedRpcSeq = 0;
  let integratedMessageBound = false;
  let installedCompiledConfig = null;
  let installedCompiledSignature = '';
  const approvedCompiledChanges = new Set();

  const $ = (id) => document.getElementById(id);
  const map = L.map('map', { zoomControl: true, maxZoom: 23 }).setView([state.spawn.lat, state.spawn.lon], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19,
    maxZoom: 23,
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
  const objectHeadingLines = new Map();
  const routeDebugLayer = L.layerGroup().addTo(map);
  const personRouteLayer = L.layerGroup().addTo(map);
  const routeDebugStartMarker = L.marker(
    offsetLatLon(state.spawn.lat, state.spawn.lon, routeDebugStart.northM, routeDebugStart.eastM),
    { icon: markerIcon('route-debug-start-icon', 'P'), draggable: true, opacity: 0 }
  ).addTo(map);

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

  function hangarDefinitionFor(title = state?.hangar?.objectTitle) {
    return HANGAR_DEFINITIONS.get(normalizeHangarTitle(title)) || null;
  }

  function hangarFootprintFor(title = state?.hangar?.objectTitle) {
    const footprint = hangarDefinitionFor(title)?.footprint;
    const widthM = Number(footprint?.widthM);
    const depthM = Number(footprint?.depthM);
    return Number.isFinite(widthM) && Number.isFinite(depthM) ? { widthM, depthM } : { widthM: 18, depthM: 22 };
  }

  function isNavigableHangarTitle(title) {
    return HANGAR_DEFINITIONS.has(title) || ASSET_DEFINITIONS.get(title)?.kind === 'hangar';
  }

  function normalizeControls(rawControls, legacyAnimation = null) {
    let controls = Array.isArray(rawControls) ? rawControls : [];
    if (!controls.length && legacyAnimation?.type === 'door') {
      const legacyControl = legacyAnimation.control;
      controls = [{
        schemaVersion: 1, id: 'door', type: 'animation', label: 'Hangartor',
        transport: legacyControl?.transport, simvar: legacyControl?.simvar, unit: 'number', scope: legacyControl?.scope || 'global',
        defaultState: legacyAnimation.defaultState || 'open', durationMs: 5000,
        states: [
          { id: 'open', label: 'Öffnen', value: legacyControl?.values?.open },
          { id: 'closed', label: 'Schließen', value: legacyControl?.values?.closed }
        ]
      }];
    }
    const ids = new Set();
    return controls.slice(0, 12).flatMap((raw) => {
      const id = String(raw?.id || '').trim();
      const idKey = id.toLowerCase();
      const type = String(raw?.type || '').trim().toLowerCase();
      const simvar = String(raw?.simvar || '').trim().toUpperCase();
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id) || ids.has(idKey)) return [];
      const scope = String(raw?.scope || 'global').toLowerCase();
      const validVariable = scope === 'simobject'
        ? /^(?:L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar)
        : /^L:VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar);
      if (!['animation', 'light'].includes(type) || raw?.transport !== 'simconnect-lvar' || !validVariable || !['global', 'simobject'].includes(scope)) return [];
      const stateIds = new Set();
      const values = new Set();
      const states = (Array.isArray(raw?.states) ? raw.states : []).slice(0, 12).flatMap((item) => {
        const stateId = String(item?.id || '').trim().toLowerCase();
        const value = Number(item?.value);
        if (!/^[a-z][a-z0-9_-]{0,31}$/.test(stateId) || stateIds.has(stateId) || !Number.isFinite(value) || values.has(value)) return [];
        stateIds.add(stateId); values.add(value);
        return [{ id: stateId, label: String(item?.label || stateId).trim().slice(0, 40), value }];
      });
      if (states.length < 2) return [];
      ids.add(idKey);
      return [{
        schemaVersion: 1, id, type, label: String(raw?.label || id).trim().slice(0, 80),
        transport: 'simconnect-lvar', simvar, unit: 'number', scope,
        defaultState: stateIds.has(String(raw?.defaultState || '').toLowerCase()) ? String(raw.defaultState).toLowerCase() : states[0].id,
        durationMs: Math.max(0, Math.min(600000, Math.round(Number(raw?.durationMs) || 0))), states
      }];
    });
  }

  function controlsForTitle(rawTitle) {
    const title = LEGACY_TITLE_ALIASES.get(String(rawTitle || '')) || String(rawTitle || '');
    const definition = ASSET_DEFINITIONS.get(title);
    return normalizeControls(definition?.controls, definition?.animation);
  }

  function headingCorrectionFor(rawTitle) {
    const title = LEGACY_TITLE_ALIASES.get(String(rawTitle || '')) || String(rawTitle || '');
    return finite(ASSET_DEFINITIONS.get(title)?.headingCorrectionDeg, 0);
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

  function normalizePersonStop(raw, index = 0) {
    const targetType = raw?.targetType === 'waypoint' ? 'waypoint' : 'object';
    return {
      id: String(raw?.id || `stop-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `stop-${index + 1}`,
      targetType,
      targetId: String(raw?.targetId || 'hangar').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
      northM: clamp(raw?.northM, -2000, 2000),
      eastM: clamp(raw?.eastM, -2000, 2000),
      waitMinS: clamp(raw?.waitMinS ?? raw?.waitS ?? 0, 0, 3600),
      waitMaxS: clamp(raw?.waitMaxS ?? raw?.waitMinS ?? raw?.waitS ?? 0, 0, 3600)
    };
  }

  function normalizePerson(raw, index = 0) {
    const fallback = TARMAC_PEOPLE[0] || { title: 'Tarmac_Male_Summer_Asian', label: 'Tarmac-Person' };
    const requestedTitle = String(raw?.title || '').trim();
    const migratedTitle = TARMAC_PERSON_TITLE_ALIASES[requestedTitle] || requestedTitle;
    const selectedModel = TARMAC_PEOPLE.find((entry) => entry.title === migratedTitle) || fallback;
    return {
      id: String(raw?.id || `person-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `person-${index + 1}`,
      title: selectedModel.title,
      label: String(raw?.label || `Mitarbeiter ${index + 1}`).slice(0, 80),
      startNorthM: clamp(raw?.startNorthM ?? 12 + index * 2, -2000, 2000),
      startEastM: clamp(raw?.startEastM ?? index * 2, -2000, 2000),
      speedKts: clamp(raw?.speedKts ?? 2.6, 1, 5),
      randomTargets: raw?.randomTargets === true,
      randomWaitMinS: clamp(raw?.randomWaitMinS ?? 5, 0, 3600),
      randomWaitMaxS: clamp(raw?.randomWaitMaxS ?? 30, 0, 3600),
      stops: Array.isArray(raw?.stops) ? raw.stops.slice(0, 20).map(normalizePersonStop) : []
    };
  }

  function normalizePersistedControlStates(raw) {
    return (Array.isArray(raw) ? raw : []).slice(0, 200).flatMap((entry) => {
      const instanceId = String(entry?.instanceId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      const title = String(entry?.title || '').trim().slice(0, 160);
      const controlId = String(entry?.controlId || '').trim().toLowerCase();
      const stateId = String(entry?.stateId ?? entry?.state ?? '').trim().toLowerCase();
      if (!instanceId || !title
        || !/^[a-z][a-z0-9_-]{0,31}$/.test(controlId)
        || !/^[a-z][a-z0-9_-]{0,31}$/.test(stateId)) return [];
      return [{ instanceId, title, controlId, stateId }];
    });
  }

  function automaticPersonDestinations(person) {
    return state.objects.slice(0, 100).map((item, index) => ({
      id: `auto-${String(item.id || index + 1)}`.slice(0, 64),
      targetType: 'object',
      targetId: String(item.id || ''),
      northM: 0,
      eastM: 0,
      waitMinS: clamp(person?.randomWaitMinS ?? 5, 0, 3600),
      waitMaxS: clamp(person?.randomWaitMaxS ?? 30, 0, 3600)
    })).filter((destination) => destination.targetId);
  }

  function personRuntimeDestinations(person) {
    return person?.randomTargets === true
      ? automaticPersonDestinations(person)
      : (Array.isArray(person?.stops) ? person.stops.map((stop) => ({ ...stop })) : []);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.spawn && saved?.hangar) {
        return {
          doorAutomationEnabled: saved.doorAutomationEnabled !== false,
          spawn: { ...DEFAULT.spawn, ...saved.spawn },
          hangar: { ...DEFAULT.hangar, ...saved.hangar, widthM: 18, depthM: 22, objectTitle: normalizeHangarTitle(saved.hangar.objectTitle) },
          objects: Array.isArray(saved.objects) ? saved.objects.slice(0, 100).map(normalizeObject) : [],
          people: Array.isArray(saved.people) ? saved.people.slice(0, 3).map(normalizePerson) : [],
          controlStates: normalizePersistedControlStates(saved.controlStates)
        };
      }
      const legacy = JSON.parse(localStorage.getItem('vfr-homebase-workbench-v1') || 'null');
      if (legacy?.spawn && legacy?.hangar) {
        return { doorAutomationEnabled: true, spawn: { ...DEFAULT.spawn, ...legacy.spawn }, hangar: { ...DEFAULT.hangar, ...legacy.hangar, widthM: 18, depthM: 22, objectTitle: normalizeHangarTitle(legacy.hangar.objectTitle) }, objects: [], people: [], controlStates: [] };
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

  function postSyncDraft(options = {}) {
    if (!INTEGRATED) return;
    window.parent.postMessage({
      channel: 'vfr-homebase',
      kind: 'sync-draft',
      plan: state,
      runtimeConfig: buildConfig(),
      dirty: syncMeta.dirty,
      baseRevision: syncMeta.baseRevision,
      localUpdatedAt: syncMeta.localUpdatedAt,
      deviceId: syncMeta.deviceId,
      crewShareEnabled: syncMeta.crewShareEnabled === true,
      suppressAutoSave: options.suppressAutoSave === true
    }, PARENT_ORIGIN);
  }

  function saveState(options = {}) {
    state.controlStates = serializeAcknowledgedControlStates();
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
      doorAutomationEnabled: source.doorAutomationEnabled !== false,
      spawn: { ...DEFAULT.spawn, ...(source.spawn || {}), heading: normalizeHeading(source.spawn?.heading), mode: 'airport_parking' },
      hangar: {
        ...DEFAULT.hangar,
        ...(source.hangar || {}),
        objectTitle: normalizeHangarTitle(source.hangar?.objectTitle),
        widthM: clamp(source.hangar?.widthM ?? 18, 4, 80),
        depthM: clamp(source.hangar?.depthM ?? 22, 4, 100)
      },
      objects: Array.isArray(source.objects) ? source.objects.slice(0, 100).map(normalizeObject) : [],
      people: Array.isArray(source.people) ? source.people.slice(0, 3).map(normalizePerson) : [],
      controlStates: normalizePersistedControlStates(source.controlStates)
    };
  }

  function applyCloudRecord(record, options = {}) {
    const localPeople = state.people.slice(0, 3).map(normalizePerson);
    const cloudClientUpdatedAt = finite(record?.clientUpdatedAt, 0);
    const legacyPeopleRecord = finite(record?.schemaVersion, 1) < 2;
    const preserveLocalPeople = options.preserveLocalPeople !== false
      && localPeople.length > 0
      && legacyPeopleRecord;
    const plan = normalizedPlan(preserveLocalPeople
      ? { ...(record?.plan || {}), people: localPeople }
      : record?.plan);
    state.spawn = plan.spawn;
    state.hangar = plan.hangar;
    state.objects = plan.objects;
    state.people = plan.people;
    state.controlStates = plan.controlStates;
    state.doorAutomationEnabled = plan.doorAutomationEnabled;
    selectedObjectId = state.objects[0]?.id || null;
    selectedPersonId = state.people[0]?.id || null;
    objectSeq = state.objects.length;
    personSeq = state.people.length;
    syncMeta.baseRevision = String(record?.revision || '');
    syncMeta.cloudUpdatedAt = finite(record?.updatedAt, Date.now());
    syncMeta.localUpdatedAt = preserveLocalPeople
      ? Math.max(syncMeta.localUpdatedAt, cloudClientUpdatedAt)
      : finite(record?.clientUpdatedAt, syncMeta.cloudUpdatedAt);
    syncMeta.crewShareEnabled = record?.crewShareEnabled !== false;
    syncMeta.dirty = preserveLocalPeople;
    hydrateAcknowledgedControlStatesFromPlan();
    saveState({ markDirty: false });
    syncInputsFromState();
    updateMap();
    map.setView([state.spawn.lat, state.spawn.lon], map.getZoom());
    if (preserveLocalPeople) {
      setPill('syncPill', 'Alter Personenstand wird migriert', 'warn');
      log('Der Cloud-Stand stammt aus dem alten Homebase-Schema. Die lokal gespeicherten Personen und Routen wurden beibehalten und werden in das vollständige Schema übertragen.', 'info');
    }
    return { preservedLocalPeople: preserveLocalPeople };
  }

  function plansEqual(left, right) {
    try { return JSON.stringify(normalizedPlan(left)) === JSON.stringify(normalizedPlan(right)); } catch (_) { return false; }
  }

  function resolveCloudConflict(record, source = 'load') {
    if (!record?.plan) return;
    const crewShareMatches = (record?.crewShareEnabled !== false) === (syncMeta.crewShareEnabled === true);
    const completePeopleSchema = finite(record?.schemaVersion, 1) >= 2 || state.people.length === 0;
    if (plansEqual(state, record.plan) && crewShareMatches && completePeopleSchema) {
      syncMeta.baseRevision = String(record.revision || '');
      syncMeta.cloudUpdatedAt = finite(record.updatedAt, Date.now());
      syncMeta.dirty = false;
      saveState({ markDirty: false });
      setPill('syncPill', 'Homebase synchronisiert', 'ok');
      return;
    }
    if (!syncMeta.dirty) {
      const applied = applyCloudRecord(record);
      if (!applied.preservedLocalPeople) {
        setPill('syncPill', 'Cloud-Version geladen', 'ok');
        log('Aktuellere Homebase-Planung der Pilot-ID geladen.', 'ok');
      }
      return;
    }
    const cloudTime = finite(record.updatedAt, 0) ? new Date(record.updatedAt).toLocaleString('de-DE') : 'unbekannt';
    const useCloud = window.confirm(
      `Die Homebase wurde auf einem anderen Gerät geändert (${cloudTime}).\n\n` +
      'OK lädt die Cloud-Version.\nAbbrechen behält diese lokale Version und speichert sie als neuen Stand.'
    );
    if (useCloud) {
      applyCloudRecord(record, { preserveLocalPeople: false });
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

  function objectHeadingLineLengthM(lat) {
    const latitudeScale = Math.max(.05, Math.cos(finite(lat) * Math.PI / 180));
    const metersPerPixel = latitudeScale * 2 * Math.PI * 6378137 / (256 * (2 ** map.getZoom()));
    const linePixels = clamp(18 + (map.getZoom() - 15) * 2, 18, 28);
    return metersPerPixel * linePixels;
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

  function routeFootprintForTitle(title) {
    const definition = ASSET_DEFINITIONS.get(String(title || ''));
    const footprint = definition?.footprint || ASSET_CATALOG.navigationFootprints?.[title];
    const widthM = Math.max(.1, finite(footprint?.widthM, 1));
    const depthM = Math.max(.1, finite(footprint?.depthM, 1));
    return { widthM, depthM };
  }

  function hangarWallObstaclesFor(zone, title = '') {
    const widthM = Math.max(4, finite(zone.widthM, 18));
    const depthM = Math.max(4, finite(zone.depthM, 22));
    const wallM = .3;
    const openingM = Math.min(widthM - 2, 5);
    const frontSegmentM = Math.max(.5, (widthM - openingM) / 2);
    const center = { northM: zone.northM, eastM: zone.eastM };
    const place = (suffix, label, forwardM, rightM, segmentWidthM, segmentDepthM) => {
      const radians = normalizeHeading(zone.heading) * Math.PI / 180;
      return {
        id: `${zone.id}-wall-${suffix}`, label, kind: title === OPEN_PARKING_TITLE ? 'open-parking-wall' : 'hangar-wall',
        northM: center.northM + Math.cos(radians) * forwardM - Math.sin(radians) * rightM,
        eastM: center.eastM + Math.sin(radians) * forwardM + Math.cos(radians) * rightM,
        heading: zone.heading, widthM: segmentWidthM, depthM: segmentDepthM
      };
    };
    return [
      place('back', 'Hangarwand hinten', -depthM / 2, 0, widthM, wallM),
      place('left', 'Hangarwand links', 0, -widthM / 2, wallM, depthM),
      place('right', 'Hangarwand rechts', 0, widthM / 2, wallM, depthM),
      place('front-left', 'Hangarwand am Tor links', depthM / 2, -(openingM + frontSegmentM) / 2, frontSegmentM, wallM),
      place('front-right', 'Hangarwand am Tor rechts', depthM / 2, (openingM + frontSegmentM) / 2, frontSegmentM, wallM)
    ];
  }

  function routeHangarBoundary() {
    return {
      id: 'hangar', label: 'Hangar-Innenraum', kind: 'hangar-zone',
      northM: state.hangar.northM, eastM: state.hangar.eastM,
      heading: state.hangar.heading, widthM: state.hangar.widthM, depthM: state.hangar.depthM
    };
  }

  function routeHangarBoundaries() {
    const zones = [routeHangarBoundary()];
    state.objects.forEach((item) => {
      if (!isNavigableHangarTitle(item.title)) return;
      const footprint = routeFootprintForTitle(item.title);
      const scale = finite(item.scale, 1);
      zones.push({
        id: item.id, label: item.label || item.title, kind: 'hangar-zone', title: item.title,
        northM: item.northM, eastM: item.eastM, heading: item.heading,
        widthM: footprint.widthM * scale, depthM: footprint.depthM * scale
      });
    });
    return zones;
  }

  function routeDebugObstacles() {
    const obstacles = [];
    obstacles.push(...hangarWallObstaclesFor(routeHangarBoundary(), state.hangar.objectTitle));
    state.objects.forEach((item) => {
      const footprint = routeFootprintForTitle(item.title);
      if (isNavigableHangarTitle(item.title)) {
        const scale = finite(item.scale, 1);
        obstacles.push(...hangarWallObstaclesFor({
          id: item.id, northM: item.northM, eastM: item.eastM, heading: item.heading,
          widthM: footprint.widthM * scale, depthM: footprint.depthM * scale
        }, item.title));
        return;
      }
      obstacles.push({
        id: item.id, label: item.label || item.title, kind: 'object',
        northM: item.northM, eastM: item.eastM, heading: item.heading,
        widthM: footprint.widthM, depthM: footprint.depthM, scale: finite(item.scale, 1)
      });
    });
    return obstacles;
  }

  function routeAircraftObstacle() {
    if (!$('routeAircraftZoneToggle')?.checked) return null;
    const position = lastTelemetry
      ? localOffsetMeters(state.spawn.lat, state.spawn.lon, lastTelemetry.lat, lastTelemetry.lon)
      : { northM: 0, eastM: 0 };
    return {
      id: '__aircraft__', label: 'Flugzeug 10 × 10 m', kind: 'aircraft',
      northM: position.northM, eastM: position.eastM,
      heading: lastTelemetry?.heading ?? state.spawn.heading, sizeM: 10
    };
  }

  function routePointLatLng(point) {
    const result = offsetLatLon(state.spawn.lat, state.spawn.lon, finite(point?.northM), finite(point?.eastM));
    return [result.lat, result.lng];
  }

  function updateRouteDebugTargets() {
    const select = $('routeTargetSelect');
    if (!select) return;
    const selected = select.value;
    const targets = [];
    if (state.hangar.objectTitle !== OPEN_PARKING_TITLE) targets.push({ id: 'hangar', label: 'Hangar / Torbereich' });
    state.objects.forEach((item, index) => targets.push({ id: item.id, label: `${index + 1}. ${item.label || item.title}` }));
    select.textContent = '';
    targets.forEach((target) => {
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = target.label;
      select.append(option);
    });
    if (targets.some((target) => target.id === selected)) select.value = selected;
    select.disabled = targets.length === 0;
    $('routePlanBtn').disabled = targets.length === 0;
  }

  function renderRouteDebug(result = routeDebugResult) {
    routeDebugLayer.clearLayers();
    routeDebugStartMarker.setOpacity(routeDebugEnabled ? 1 : 0);
    routeDebugStartMarker.setLatLng(routePointLatLng(routeDebugStart));
    if (!routeDebugEnabled || !result) return;
    const polygons = result.debug?.obstaclePolygons || (result.obstacles || []).map((obstacle) => ({
      id: obstacle.id, label: obstacle.label, points: ROUTE_CORE.obstacleCorners(obstacle, true)
    }));
    polygons.forEach((polygon) => {
      const aircraft = polygon.id === '__aircraft__';
      const hangar = polygon.id === 'hangar';
      L.polygon(polygon.points.map(routePointLatLng), {
        color: aircraft ? '#ffb44a' : hangar ? '#bbf451' : '#ff645e',
        weight: 2, dashArray: aircraft ? '7 5' : null,
        fillColor: aircraft ? '#a65a14' : hangar ? '#456a1b' : '#7d2428', fillOpacity: .22,
        interactive: false
      }).bindTooltip(polygon.label || 'Sperrfläche').addTo(routeDebugLayer);
    });
    if (result.ok && result.rawPath?.length > 1) {
      L.polyline(result.rawPath.map(routePointLatLng), { color: '#d4dde0', weight: 2, opacity: .6, dashArray: '4 5', interactive: false }).addTo(routeDebugLayer);
    }
    if (result.ok && result.path?.length > 1) {
      L.polyline(result.path.map(routePointLatLng), { color: '#54d7d0', weight: 5, opacity: .95, interactive: false }).addTo(routeDebugLayer);
      L.marker(routePointLatLng(result.goal), { icon: markerIcon('route-debug-target-icon', 'Z'), interactive: false }).addTo(routeDebugLayer);
    }
  }

  function planRouteDebug() {
    if (!routeDebugEnabled) return;
    routeDebugStart = {
      northM: clamp($('routeStartNorth').value, -1000, 1000),
      eastM: clamp($('routeStartEast').value, -1000, 1000)
    };
    const targetObjectId = String($('routeTargetSelect').value || '');
    if (!targetObjectId) {
      routeDebugResult = null;
      renderRouteDebug();
      setResult('routeDebugResult', 'Platziere zuerst einen Hangar oder ein Ausstattungsobjekt.', false);
      return;
    }
    routeDebugResult = compilePersonLeg(
      routeDebugStart,
      { targetType: 'object', targetId: targetObjectId },
      routeAircraftObstacle()
    );
    renderRouteDebug(routeDebugResult);
    if (!routeDebugResult.ok) {
      setResult('routeDebugResult', `Keine freie Route zum gewählten Ziel (${routeDebugResult.error || 'unbekannter Fehler'}).`, false);
      return;
    }
    const sideNames = { front: 'Vorderseite', right: 'rechte Seite', back: 'Rückseite', left: 'linke Seite' };
    const distanceM = Number.isFinite(routeDebugResult.distanceM) ? routeDebugResult.distanceM : ROUTE_CORE.pathDistance(routeDebugResult.path);
    const interaction = routeDebugResult.interactionSide ? `; Interaktion an der ${sideNames[routeDebugResult.interactionSide] || routeDebugResult.interactionSide}` : '';
    setResult('routeDebugResult', `${distanceM.toFixed(1)} m über ${Math.max(0, routeDebugResult.path.length - 1)} Wegabschnitte${interaction}.`, true);
  }

  function aircraftMovedForRoutePlanner() {
    const next = routeAircraftObstacle();
    if (!next) return false;
    const previous = routeDebugLastAircraft;
    routeDebugLastAircraft = next;
    if (!previous) return true;
    const distance = Math.hypot(next.northM - previous.northM, next.eastM - previous.eastM);
    const headingDelta = Math.abs((((next.heading - previous.heading) % 360) + 540) % 360 - 180);
    return distance >= 1 || headingDelta >= 10;
  }

  function selectedPerson() {
    return state.people.find((item) => item.id === selectedPersonId) || null;
  }

  function hangarRouteObstacle() {
    return routeHangarBoundary();
  }

  function hangarContaining(point) {
    return routeHangarBoundaries().find((hangar) => ROUTE_CORE.pointInsideObstacle(point, ROUTE_CORE.normalizeObstacle({ ...hangar, clearanceM: 0 }))) || null;
  }

  function pointInsideHangar(point) {
    return !!hangarContaining(point);
  }

  function hangarEntryPoint(hangar = hangarRouteObstacle()) {
    if (!hangar) return null;
    const normalized = ROUTE_CORE.normalizeObstacle(hangar, { clearanceM: .65 });
    return ROUTE_CORE.interactionCandidates(normalized, { interactionOffsetM: 1 })[0];
  }

  function routeGoalForStop(stop) {
    if (stop.targetType === 'waypoint') return { northM: stop.northM, eastM: stop.eastM, targetId: null };
    if (stop.targetId === 'hangar') return { northM: state.hangar.northM, eastM: state.hangar.eastM, targetId: 'hangar', insideHangar: true };
    return { targetId: stop.targetId };
  }

  function compilePersonLeg(start, stop, aircraft = routeAircraftObstacle()) {
    const obstacles = routeDebugObstacles();
    const goal = routeGoalForStop(stop);
    const startHangar = hangarContaining(start);
    const targetHangar = goal.targetId ? routeHangarBoundaries().find((hangar) => hangar.id === goal.targetId) || null : null;
    const targetObstacle = goal.targetId && goal.targetId !== 'hangar' ? obstacles.find((obstacle) => obstacle.id === goal.targetId) : null;
    const goalPoint = targetHangar || targetObstacle || goal;
    const goalHangar = targetHangar || (goal.insideHangar === true ? routeHangarBoundary() : hangarContaining(goalPoint));
    const entry = goalHangar ? hangarEntryPoint(goalHangar) : null;
    const planToGoal = (routeStart) => goal.targetId && goal.targetId !== 'hangar' && !targetHangar
      ? ROUTE_CORE.planRouteToObject({ start: routeStart, targetObjectId: goal.targetId, obstacles, aircraft, cellSizeM: .5, clearanceM: .65, interactionOffsetM: 1 })
      : ROUTE_CORE.planRoute({ start: routeStart, goal: { northM: goalPoint.northM, eastM: goalPoint.eastM }, obstacles, aircraft, cellSizeM: .5, clearanceM: .65 });
    if (!entry || startHangar?.id === goalHangar?.id) return planToGoal(start);
    if (goalHangar) {
      const approach = ROUTE_CORE.planRoute({ start, goal: entry, obstacles, aircraft, cellSizeM: .5, clearanceM: .65 });
      if (!approach.ok) return approach;
      const interior = planToGoal(entry);
      if (!interior.ok) return interior;
      const path = [...approach.path, ...interior.path.slice(1)];
      return {
        ...interior, path, distanceM: ROUTE_CORE.pathDistance(path), hangarId: goalHangar.id
      };
    }
    return planToGoal(start);
  }

  function compilePersonRoute(person) {
    if (!person) return { ok: false, error: 'person_not_found', points: [] };
    const start = { northM: person.startNorthM, eastM: person.startEastM };
    start.insideHangar = pointInsideHangar(start);
    const routes = [];
    for (const stop of personRuntimeDestinations(person)) {
      const leg = compilePersonLeg(start, stop);
      if (!leg.ok || !leg.path?.length) return { ok: false, error: leg.error || 'no_route', stopId: stop.id, routes };
      routes.push({ stop, path: leg.path, distanceM: ROUTE_CORE.pathDistance(leg.path) });
    }
    return { ok: routes.length > 0, error: routes.length ? null : 'no_stops', routes };
  }

  function renderSelectedPersonRoute() {
    personRouteLayer.clearLayers();
    const person = selectedPerson();
    if (!person) return;
    const route = person.randomTargets === true ? { ok: true, routes: [] } : compilePersonRoute(person);
    const spawnMarker = L.marker(routePointLatLng({ northM: person.startNorthM, eastM: person.startEastM }), {
      icon: markerIcon('route-debug-start-icon', 'P'), draggable: true, autoPan: true
    }).bindTooltip(`${person.label} · Startpunkt ziehen`).addTo(personRouteLayer);
    spawnMarker.on('dragend', () => {
      const point = spawnMarker.getLatLng();
      const local = localOffsetMeters(state.spawn.lat, state.spawn.lon, point.lat, point.lng);
      person.startNorthM = clamp(local.northM, -2000, 2000);
      person.startEastM = clamp(local.eastM, -2000, 2000);
      saveState(); syncInputsFromState(); updateMap(); schedulePeopleLiveSync();
    });
    if (person.randomTargets === true) return;
    route.routes.forEach((candidate, index) => {
      L.polyline(candidate.path.map(routePointLatLng), { color: '#bbf451', weight: 3, opacity: .65, dashArray: '9 5', interactive: false }).addTo(personRouteLayer);
    });
    const routeByStopId = new Map(route.routes.map((candidate) => [candidate.stop.id, candidate]));
    person.stops.forEach((stop, index) => {
      const candidate = routeByStopId.get(stop.id);
      if (stop.targetType !== 'waypoint' && !candidate) return;
      const target = stop.targetType === 'waypoint'
        ? { northM: stop.northM, eastM: stop.eastM }
        : candidate.path[candidate.path.length - 1];
      const marker = L.marker(routePointLatLng(target), {
        icon: markerIcon('route-debug-target-icon', String(index + 1)),
        draggable: stop.targetType === 'waypoint',
        autoPan: stop.targetType === 'waypoint',
        interactive: true
      }).bindTooltip(stop.targetType === 'waypoint' ? `Freier Wegpunkt ${index + 1} ziehen` : `Objektziel ${index + 1}`)
        .addTo(personRouteLayer);
      if (stop.targetType !== 'waypoint') return;
      marker.on('dragend', () => {
        const point = marker.getLatLng();
        const local = localOffsetMeters(state.spawn.lat, state.spawn.lon, point.lat, point.lng);
        stop.northM = clamp(local.northM, -2000, 2000);
        stop.eastM = clamp(local.eastM, -2000, 2000);
        saveState(); renderPeople(); updateMap(); schedulePeopleLiveSync();
      });
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
        option.textContent = `${entry.icon || '•'} ${entry.label}`;
        optgroup.append(option);
      });
      $('catalogSelect').append(optgroup);
    });
  }

  function fillPersonCatalog() {
    const select = $('personModelSelect');
    select.textContent = '';
    TARMAC_PEOPLE.forEach((person) => {
      const option = document.createElement('option');
      option.value = person.title;
      option.textContent = person.label;
      select.append(option);
    });
  }

  function personDestinationOptions(selectedValue = '') {
    const options = [];
    if (state.hangar.objectTitle !== OPEN_PARKING_TITLE) options.push({ value: 'hangar', label: 'Hangar innen' });
    state.objects.forEach((item, index) => options.push({ value: item.id, label: `${index + 1}. ${item.label || item.title}` }));
    options.push({ value: '__waypoint__', label: 'Freier Wegpunkt' });
    return options.map((entry) => {
      const option = document.createElement('option');
      option.value = entry.value;
      option.textContent = entry.label;
      option.selected = entry.value === selectedValue;
      return option;
    });
  }

  function renderPersonStops(person) {
    const container = $('personStops');
    container.textContent = '';
    person.stops.forEach((stop, index) => {
      const root = document.createElement('div');
      root.className = 'person-stop';
      const head = document.createElement('div');
      head.className = 'person-stop-head';
      const title = document.createElement('strong');
      title.textContent = `Mögliches Ziel ${index + 1}`;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'danger person-stop-remove'; remove.textContent = 'Entfernen';
      remove.addEventListener('click', () => { person.stops.splice(index, 1); saveState(); renderPeople(); updateMap(); schedulePeopleLiveSync(); });
      head.append(title, remove);
      const fields = document.createElement('div');
      fields.className = 'person-stop-fields';
      const targetLabel = document.createElement('label');
      targetLabel.className = 'person-stop-target'; targetLabel.textContent = 'Ziel';
      const target = document.createElement('select');
      const selectedTarget = stop.targetType === 'waypoint' ? '__waypoint__' : stop.targetId;
      personDestinationOptions(selectedTarget).forEach((option) => target.append(option));
      target.addEventListener('change', () => {
        stop.targetType = target.value === '__waypoint__' ? 'waypoint' : 'object';
        stop.targetId = stop.targetType === 'object' ? target.value : '';
        saveState(); renderPeople(); updateMap(); schedulePeopleLiveSync();
      });
      targetLabel.append(target);
      fields.append(targetLabel);
      const coordinateLabels = [['northM', 'Wegpunkt nördlich, m'], ['eastM', 'Wegpunkt östlich, m']].map(([key, text]) => {
        const label = document.createElement('label');
        label.className = 'person-stop-coordinate'; label.hidden = stop.targetType !== 'waypoint'; label.textContent = text;
        const input = document.createElement('input'); input.type = 'number'; input.step = '.5'; input.value = stop[key];
        const persistCoordinate = () => { stop[key] = clamp(input.value, -2000, 2000); saveState(); updateMap(); schedulePeopleLiveSync(); };
        input.addEventListener('input', persistCoordinate);
        input.addEventListener('change', persistCoordinate);
        label.append(input); return label;
      });
      fields.append(...coordinateLabels);
      [['waitMinS', 'Wartezeit min., s'], ['waitMaxS', 'Wartezeit max., s']].forEach(([key, text]) => {
        const label = document.createElement('label'); label.textContent = text;
        const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '3600'; input.step = '1'; input.value = stop[key];
        const persistWait = () => { stop[key] = clamp(input.value, 0, 3600); saveState(); updateMap(); schedulePeopleLiveSync(); };
        input.addEventListener('input', persistWait);
        input.addEventListener('change', persistWait);
        label.append(input); fields.append(label);
      });
      root.append(head, fields);
      container.append(root);
    });
    if (!person.stops.length) {
      const empty = document.createElement('div'); empty.className = 'object-empty'; empty.textContent = 'Füge mindestens ein mögliches Ziel hinzu.'; container.append(empty);
    }
  }

  function renderPeople() {
    const list = $('peopleList');
    list.textContent = '';
    state.people.forEach((person, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `object-list-item${person.id === selectedPersonId ? ' selected' : ''}`;
      button.textContent = person.randomTargets === true
        ? `${index + 1}. ${person.label} · Zufallsziele (${state.objects.length})`
        : `${index + 1}. ${person.label} · ${person.stops.length} Ziele`;
      button.addEventListener('click', () => { selectedPersonId = person.id; renderPeople(); updateMap(); });
      list.append(button);
    });
    $('peopleCount').textContent = `${state.people.length} / 3`;
    $('peopleEmpty').hidden = state.people.length > 0;
    $('addPersonBtn').disabled = state.people.length >= 3 || TARMAC_PEOPLE.length === 0;
    const person = selectedPerson();
    $('personEditor').disabled = !person;
    if (!person) {
      $('personEditorTitle').textContent = 'Person bearbeiten';
      $('personStops').textContent = '';
      setResult('peopleResult', 'Personen werden zusammen mit der automatischen Homebase geladen.');
      renderSelectedPersonRoute();
      return;
    }
    $('personEditorTitle').textContent = person.label;
    $('personModelSelect').value = person.title;
    $('personStartNorth').value = Number(person.startNorthM.toFixed(1));
    $('personStartEast').value = Number(person.startEastM.toFixed(1));
    $('personSpeed').value = Number(person.speedKts.toFixed(1));
    $('personRandomTargetsToggle').checked = person.randomTargets === true;
    $('personRandomWaitMin').value = Number(person.randomWaitMinS.toFixed(0));
    $('personRandomWaitMax').value = Number(person.randomWaitMaxS.toFixed(0));
    $('personRandomTargetsSettings').hidden = person.randomTargets !== true;
    $('personManualTargets').hidden = person.randomTargets === true;
    $('personRandomTargetsHint').textContent = state.objects.length
      ? `${state.objects.length} platzierte Objekt(e) werden automatisch als Ziele verwendet. Unerreichbare Ziele werden übersprungen.`
      : 'Noch keine platzierten Objekte vorhanden. Der Mitarbeiter wartet, bis ein Objekt als Ziel verfügbar ist.';
    if (person.randomTargets === true) $('personStops').textContent = '';
    else renderPersonStops(person);
    const route = person.randomTargets === true ? null : compilePersonRoute(person);
    setResult('peopleResult', person.randomTargets === true
      ? (state.objects.length
        ? `Zufallsmodus aktiv: ${state.objects.length} Objektziel(e); unerreichbare Ziele werden automatisch übersprungen.`
        : 'Zufallsmodus aktiv, aber noch keine Objektziele vorhanden.')
      : (route.ok
        ? `${person.stops.length} mögliche Ziele; der nächste Abschnitt wird jeweils zufällig und neu geplant.`
        : (person.stops.length ? `Mindestens ein Ziel ist derzeit nicht erreichbar (${route.error}).` : 'Füge mögliche Objektziele oder freie Wegpunkte hinzu.')), person.randomTargets === true ? state.objects.length > 0 : route.ok ? true : null);
    renderSelectedPersonRoute();
  }

  function addPerson() {
    if (state.people.length >= 3 || !TARMAC_PEOPLE.length) return;
    const person = normalizePerson({ id: `person-${Date.now().toString(36)}-${++personSeq}`, label: `Mitarbeiter ${state.people.length + 1}` }, state.people.length);
    state.people.push(person); selectedPersonId = person.id;
    saveState(); renderPeople(); updateMap(); schedulePeopleLiveSync();
  }

  function deleteSelectedPerson() {
    const index = state.people.findIndex((person) => person.id === selectedPersonId);
    if (index < 0) return;
    state.people.splice(index, 1);
    selectedPersonId = state.people[Math.min(index, state.people.length - 1)]?.id || null;
    saveState(); renderPeople(); updateMap(); schedulePeopleLiveSync();
  }

  function addPersonDestination() {
    const person = selectedPerson();
    if (!person || person.randomTargets === true || person.stops.length >= 20) return;
    const firstTarget = state.hangar.objectTitle !== OPEN_PARKING_TITLE ? 'hangar' : state.objects[0]?.id;
    person.stops.push(normalizePersonStop({
      id: `destination-${Date.now().toString(36)}-${person.stops.length + 1}`,
      targetType: firstTarget ? 'object' : 'waypoint', targetId: firstTarget || '',
      northM: person.startNorthM + 5, eastM: person.startEastM, waitMinS: 5, waitMaxS: 30
    }, person.stops.length));
    saveState(); renderPeople(); updateMap(); schedulePeopleLiveSync();
  }

  function readSelectedPersonFromInputs(event) {
    const person = selectedPerson();
    if (!person) return;
    person.title = TARMAC_PEOPLE.some((entry) => entry.title === $('personModelSelect').value) ? $('personModelSelect').value : TARMAC_PEOPLE[0].title;
    person.startNorthM = clamp($('personStartNorth').value, -2000, 2000);
    person.startEastM = clamp($('personStartEast').value, -2000, 2000);
    person.speedKts = clamp($('personSpeed').value, 1, 5);
    saveState();
    if (event?.target?.id === 'personModelSelect') renderPeople();
    updateMap(); schedulePeopleLiveSync();
  }

  function readSelectedPersonRandomTargets(event) {
    const person = selectedPerson();
    if (!person) return;
    person.randomTargets = $('personRandomTargetsToggle').checked;
    person.randomWaitMinS = clamp($('personRandomWaitMin').value, 0, 3600);
    person.randomWaitMaxS = clamp($('personRandomWaitMax').value, 0, 3600);
    saveState();
    if (event?.target?.id === 'personRandomTargetsToggle') renderPeople();
    updateMap(); schedulePeopleLiveSync();
  }

  function mergeRuntimeAssetCatalog(entries) {
    let added = 0;
    let updated = 0;
    for (const raw of Array.isArray(entries) ? entries : []) {
      const title = String(raw?.title || '').trim().slice(0, 160);
      const folder = String(raw?.folder || '').trim().slice(0, 120);
      const kind = String(raw?.kind || '').trim().toLowerCase();
      if (!title.startsWith('VFR Multitool Homebase ') || !/^VFRHomebase[A-Za-z0-9_-]+$/.test(folder)) continue;
      if (!['object', 'hangar'].includes(kind)) continue;
      if (raw?.workbenchVisible === false) continue;
      const existingDefinition = ASSET_DEFINITIONS.get(title) || {};
      const obsoleteHeadingCorrection = [HANGAR_TITLE, OPEN_PARKING_TITLE].includes(title)
        && Number(raw?.headingCorrectionDeg) === 180
        && Number(existingDefinition?.headingCorrectionDeg) === 0;
      const mergedDefinition = {
        ...existingDefinition,
        ...raw,
        ...(obsoleteHeadingCorrection ? { headingCorrectionDeg: 0 } : {}),
        controls: normalizeControls([
          ...(Array.isArray(raw?.controls) ? raw.controls : []),
          ...(Array.isArray(existingDefinition?.controls) ? existingDefinition.controls : [])
        ], raw?.animation || existingDefinition.animation)
      };
      ASSET_DEFINITIONS.set(title, mergedDefinition);
      if (kind === 'hangar') {
        const existingHangar = HANGAR_DEFINITIONS.get(title) || {};
        HANGAR_DEFINITIONS.set(title, {
          ...existingHangar,
          ...mergedDefinition,
          ...(raw?.footprint || existingHangar?.footprint ? { footprint: raw?.footprint || existingHangar.footprint } : {}),
          ...(raw?.animation || existingHangar?.animation ? { animation: raw?.animation || existingHangar.animation } : {})
        });
        if (!HANGAR_TITLES.has(title)) {
          HANGAR_TITLES.add(title);
          const option = document.createElement('option');
          option.value = title;
          option.textContent = String(raw?.label || title.replace(/^VFR Multitool Homebase /, '')).slice(0, 120);
          $('hangarSelect').append(option);
          added += 1;
        }
      }
      if (raw?.homebasePlaceable === false) continue;
      const group = String(raw?.group || (kind === 'hangar' ? 'Hangars' : 'Weitere Objekte')).trim().slice(0, 80);
      const entry = {
        ...mergedDefinition,
        key: String(raw?.key || folder).trim().slice(0, 120),
        folder,
        title,
        kind,
        group,
        label: String(raw?.label || title.replace(/^VFR Multitool Homebase /, '')).trim().slice(0, 120),
        icon: group.toLowerCase().includes('gepäck') ? '🧳' : '◆',
        companion: true
      };
      const existingCatalog = CATALOG_BY_TITLE.get(title);
      if (existingCatalog) {
        Object.assign(existingCatalog, entry);
        updated += 1;
      } else {
        OBJECT_CATALOG.push(entry);
        CATALOG_BY_TITLE.set(title, entry);
        added += 1;
      }
      COMPANION_TITLES.add(title);
    }
    if (added || updated) {
      hydrateAcknowledgedControlStatesFromPlan();
      fillCatalog();
      renderObjectList();
      renderHomebaseControls();
      updateMap();
      log(`${added} neue und ${updated} aktualisierte Asset-Katalogeinträge vom installierten Paket übernommen.`, 'ok');
    }
    return added + updated;
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

  function controlGroupKey(title, control, instanceId = '') {
    return `${title}|${control.id}|${control.simvar}|${control.scope === 'simobject' ? instanceId : 'global'}`;
  }

  function activeControlGroups() {
    const primaryPosition = hangarPosition();
    const primaryTitle = normalizeHangarTitle(state.hangar.objectTitle);
    const primaryDefinition = ASSET_DEFINITIONS.get(primaryTitle) || {};
    const instances = [
      { title: primaryTitle, id: 'hangar', label: String(primaryDefinition.label || 'Haupt-Hangar'), lat: primaryPosition.lat, lon: primaryPosition.lng },
      ...state.objects.map((item) => {
        const position = objectPosition(item);
        return { title: item.title, id: item.id, label: item.label, lat: position.lat, lon: position.lng };
      })
    ];
    const groups = new Map();
    for (const instance of instances) {
      const definition = ASSET_DEFINITIONS.get(instance.title) || {};
      for (const control of controlsForTitle(instance.title)) {
        const key = controlGroupKey(instance.title, control, instance.id);
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
          existing.instanceIds.push(instance.id);
        } else {
          groups.set(key, {
            key, title: instance.title,
            assetLabel: control.scope === 'simobject' ? instance.label : String(definition.label || instance.title.replace(/^VFR Multitool Homebase /, '')),
            modelLabel: String(definition.label || instance.title.replace(/^VFR Multitool Homebase /, '')),
            control, count: 1, instanceIds: [instance.id], instanceId: instance.id, lat: instance.lat, lon: instance.lon
          });
        }
      }
    }
    return [...groups.values()];
  }

  function serializeAcknowledgedControlStates() {
    const groups = activeControlGroups();
    const serialized = groups.flatMap((group) => {
      const stateId = String(acknowledgedControlStates.get(group.key) || '').toLowerCase();
      if (!group.control.states.some((entry) => entry.id === stateId)) return [];
      return [{
        instanceId: group.instanceId,
        title: group.title,
        controlId: group.control.id,
        stateId
      }];
    });
    const activeInstances = new Map([
      ['hangar', normalizeHangarTitle(state.hangar.objectTitle)],
      ...state.objects.map((item) => [item.id, item.title])
    ]);
    for (const entry of normalizePersistedControlStates(state.controlStates)) {
      if (serialized.some((item) => item.instanceId === entry.instanceId
        && item.title === entry.title && item.controlId === entry.controlId)) continue;
      const knownGroup = groups.some((group) => (
        group.title === entry.title
        && String(group.control.id || '').toLowerCase() === entry.controlId
        && (group.control.scope !== 'simobject' || group.instanceId === entry.instanceId)
      ));
      if (!knownGroup && activeInstances.get(entry.instanceId) === entry.title) serialized.push(entry);
    }
    return serialized.slice(0, 200);
  }

  function hydrateAcknowledgedControlStatesFromPlan() {
    acknowledgedControlStates.clear();
    const persisted = normalizePersistedControlStates(state.controlStates);
    for (const group of activeControlGroups()) {
      const match = persisted.find((entry) => (
        entry.title === group.title
        && entry.controlId === String(group.control.id || '').toLowerCase()
        && (group.control.scope !== 'simobject' || entry.instanceId === group.instanceId)
      ));
      if (match && group.control.states.some((entry) => entry.id === match.stateId)) {
        acknowledgedControlStates.set(group.key, match.stateId);
      }
    }
    state.controlStates = serializeAcknowledgedControlStates();
  }

  function controlPanels(groups) {
    const panels = new Map();
    for (const group of groups) {
      const sharedGlobal = group.control.scope === 'global' && group.count > 1;
      const panelKey = sharedGlobal
        ? `global|${group.title}`
        : `instance|${group.title}|${group.instanceId}`;
      if (!panels.has(panelKey)) {
        panels.set(panelKey, {
          key: panelKey,
          label: group.assetLabel,
          detail: sharedGlobal ? `${group.count} Exemplare gemeinsam` : '',
          groups: []
        });
      }
      panels.get(panelKey).groups.push(group);
    }
    return [...panels.values()];
  }

  function isBuildingControlGroup(group) {
    const definition = ASSET_DEFINITIONS.get(group?.title) || {};
    const catalogGroup = String(definition.group || '').trim().toLowerCase();
    return controlVisualKind(group?.control) === 'door'
      || definition.kind === 'hangar'
      || ['gebäude', 'gebaeude', 'hangars'].includes(catalogGroup);
  }

  function createControlCategory(key, title, itemCount) {
    const category = document.createElement('details');
    category.className = 'homebase-control-category';
    category.dataset.controlCategory = key;
    category.open = controlCategoryOpenState.get(key) !== false;
    category.addEventListener('toggle', () => controlCategoryOpenState.set(key, category.open));

    const summary = document.createElement('summary');
    summary.className = 'homebase-control-category-summary';
    const heading = document.createElement('strong');
    heading.textContent = title;
    const count = document.createElement('span');
    count.className = 'homebase-control-category-count';
    count.textContent = String(itemCount);
    count.setAttribute('aria-label', `${itemCount} ${itemCount === 1 ? 'Bedienfeld' : 'Bedienfelder'}`);
    const indicator = document.createElement('span');
    indicator.className = 'collapse-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    summary.append(heading, count, indicator);

    const body = document.createElement('div');
    body.className = 'homebase-control-category-body';
    category.append(summary, body);
    return { category, body };
  }

  function createGroupControlTile(group, panel) {
    const pending = [...pendingControlCommands.values()].find((entry) => entry.key === group.key) || null;
    const functionLabel = panel.detail
      ? `${controlFunctionLabel(group.control)} · ${panel.detail}`
      : controlFunctionLabel(group.control);
    return createControlTile({
      name: panel.label,
      functionLabel,
      control: group.control,
      currentState: knownControlState(group),
      pendingState: pending?.state || '',
      busy: !!pending,
      resultKey: group.key,
      onToggle: (nextState) => requestObjectControlState(group, nextState)
    });
  }

  function setControlResult(key, message, ok = null) {
    const element = [...document.querySelectorAll('[data-control-result-key]')]
      .find((candidate) => candidate.dataset.controlResultKey === key);
    if (!element) return;
    if (element.classList.contains('homebase-control-tile-status')) {
      element.textContent = compactControlMessage(message);
      element.classList.toggle('ok', ok === true);
      element.classList.toggle('bad', ok === false);
      return;
    }
    element.textContent = message;
    element.className = `result-line${ok === true ? ' ok' : ok === false ? ' bad' : ''}`;
  }

  function actionProgressMessage(control, nextState) {
    if (controlVisualKind(control) === 'door' && nextState === 'open') return 'Tor wird geöffnet …';
    if (controlVisualKind(control) === 'door' && nextState === 'closed') return 'Tor wird geschlossen …';
    if (control.type === 'light' && nextState === 'on') return 'Licht wird eingeschaltet …';
    if (control.type === 'light' && nextState === 'off') return 'Licht wird ausgeschaltet …';
    const stateDefinition = control.states.find((item) => item.id === nextState);
    return `${control.label}: ${stateDefinition?.label || nextState} …`;
  }

  function controlFunctionLabel(control) {
    if (controlVisualKind(control) === 'door') {
      return String(control?.id || '').toLowerCase() === 'door' ? 'Tor' : (control.label || 'Tür');
    }
    if (control.type === 'light') return 'Licht';
    return control.label;
  }

  function globalControlKind(control) {
    const kind = controlVisualKind(control);
    if (kind === 'door' || kind === 'light') return kind;
    return '';
  }

  function controlButtonLabel(control, stateDefinition) {
    if (controlVisualKind(control) === 'door' && stateDefinition.id === 'open') return 'Tor öffnen';
    if (controlVisualKind(control) === 'door' && stateDefinition.id === 'closed') return 'Tor schließen';
    if (control.type === 'light' && stateDefinition.id === 'on') return 'Licht an';
    if (control.type === 'light' && stateDefinition.id === 'off') return 'Licht aus';
    return `${controlFunctionLabel(control)}: ${stateDefinition.label}`;
  }

  function confirmedControlMessage(control, state) {
    if (controlVisualKind(control) === 'door' && state === 'open') return 'Bestätigt: Tor geöffnet. Bereit.';
    if (controlVisualKind(control) === 'door' && state === 'closed') return 'Bestätigt: Tor geschlossen. Bereit.';
    if (control.type === 'light' && state === 'on') return 'Bestätigt: Licht an. Bereit.';
    if (control.type === 'light' && state === 'off') return 'Bestätigt: Licht aus. Bereit.';
    const stateDefinition = control.states.find((item) => item.id === state);
    return `Bestätigt: ${stateDefinition?.label || state}. Bereit.`;
  }

  function controlVisualKind(control) {
    if (String(control?.id || '').toLowerCase() === 'door') return 'door';
    const stateIds = new Set((Array.isArray(control?.states) ? control.states : [])
      .map((stateDefinition) => String(stateDefinition?.id || '').toLowerCase()));
    if (control?.type === 'animation' && stateIds.has('open') && stateIds.has('closed')) return 'door';
    if (control?.type === 'light' || String(control?.id || '').toLowerCase().includes('light')) return 'light';
    return 'switch';
  }

  function isHighlightedControlState(control, state) {
    const kind = controlVisualKind(control);
    if (kind === 'door') return state === 'open';
    if (kind === 'light') return state === 'on';
    return !!state && state === control.states?.[0]?.id;
  }

  function nextControlState(control, currentState = '') {
    const states = Array.isArray(control?.states) ? control.states : [];
    if (!states.length) return '';
    const currentIndex = states.findIndex((item) => item.id === currentState);
    return states[currentIndex < 0 ? 0 : (currentIndex + 1) % states.length]?.id || '';
  }

  function knownControlState(group) {
    return acknowledgedControlStates.get(group.key) || group.control?.defaultState || '';
  }

  function compactControlMessage(message) {
    const text = String(message || '').trim();
    if (/Tor wird geöffnet/i.test(text)) return 'Öffnet …';
    if (/Tor wird geschlossen/i.test(text)) return 'Schließt …';
    if (/Licht wird eingeschaltet/i.test(text)) return 'Schaltet ein …';
    if (/Licht wird ausgeschaltet/i.test(text)) return 'Schaltet aus …';
    if (/Tor geöffnet/i.test(text)) return 'Offen';
    if (/Tor geschlossen/i.test(text)) return 'Geschlossen';
    if (/Licht an/i.test(text)) return 'An';
    if (/Licht aus/i.test(text)) return 'Aus';
    if (/fehlgeschlagen|nicht gesteuert|fehlt/i.test(text)) return 'Nicht erreichbar';
    if (/Bereit/i.test(text)) return 'Bereit';
    return text.length > 34 ? `${text.slice(0, 31).trim()}…` : text;
  }

  function controlTileStatus(control, state, pendingState = '') {
    if (pendingState) return compactControlMessage(actionProgressMessage(control, pendingState));
    const kind = controlVisualKind(control);
    if (kind === 'door' && state === 'open') return 'Offen';
    if (kind === 'door' && state === 'closed') return 'Geschlossen';
    if (kind === 'light' && state === 'on') return 'An';
    if (kind === 'light' && state === 'off') return 'Aus';
    if (!state) return 'Bereit';
    return control.states?.find((item) => item.id === state)?.label || state;
  }

  function createControlTile({ name, functionLabel, control, currentState = '', pendingState = '', busy = false, status = '', resultKey = '', onToggle }) {
    const visualState = pendingState || currentState;
    const kind = controlVisualKind(control);
    const nextState = nextControlState(control, visualState);
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `homebase-control-tile homebase-control-tile-${kind}`;
    tile.disabled = busy || !nextState;
    tile.classList.toggle('is-active', isHighlightedControlState(control, visualState));
    tile.classList.toggle('is-pending', !!pendingState);
    if (visualState) tile.classList.add(`state-${String(visualState).replace(/[^a-z0-9_-]/gi, '-').toLowerCase()}`);
    tile.setAttribute('aria-pressed', String(isHighlightedControlState(control, currentState)));
    tile.setAttribute('aria-label', `${name}, ${functionLabel}: ${status || controlTileStatus(control, currentState, pendingState)}. Zustand umschalten`);

    const objectName = document.createElement('span');
    objectName.className = 'homebase-control-tile-name';
    objectName.textContent = name;
    const pictogram = document.createElement('span');
    pictogram.className = `homebase-control-pictogram homebase-control-pictogram-${kind}`;
    pictogram.setAttribute('aria-hidden', 'true');
    if (kind === 'light') {
      pictogram.innerHTML = `
        <svg viewBox="0 0 48 48" focusable="false">
          <circle class="bulb-glow" cx="24" cy="18" r="11"></circle>
          <path class="bulb-outline" d="M24 4.5c-8.1 0-14.7 6.2-14.7 13.9 0 5.1 2.7 9.1 7.1 11.9 1 .7 1.6 1.6 1.6 2.7h12c0-1.1.6-2 1.6-2.7 4.4-2.8 7.1-6.8 7.1-11.9C38.7 10.7 32.1 4.5 24 4.5Z"></path>
          <path class="bulb-socket" d="M17.5 36h13M18.8 40h10.4M21.2 44h5.6"></path>
        </svg>`;
    }
    const functionName = document.createElement('span');
    functionName.className = 'homebase-control-tile-function';
    functionName.textContent = functionLabel;
    const statusLine = document.createElement('span');
    statusLine.className = 'homebase-control-tile-status';
    statusLine.textContent = status || controlTileStatus(control, currentState, pendingState);
    if (resultKey) statusLine.dataset.controlResultKey = resultKey;
    tile.append(objectName, pictogram, functionName, statusLine);
    tile.addEventListener('click', () => onToggle?.(nextState));
    return tile;
  }

  function requestObjectControlState(group, nextState, options = {}) {
    const stateDefinition = group?.control?.states?.find((item) => item.id === nextState);
    if (!stateDefinition || [...pendingControlCommands.values()].some((entry) => entry.key === group.key)) return false;
    const controlKind = globalControlKind(group.control);
    if (!options.batchId && !options.preserveGlobalStatus && controlKind) globalControlOperations.delete(controlKind);
    const commandId = sendStabilizerCommand('homebase_v1.object.control.set', {
      title: group.title,
      controlId: group.control.id,
      state: stateDefinition.id,
      stateId: stateDefinition.id,
      value: stateDefinition.value,
      instanceId: group.instanceId,
      object: { id: group.instanceId, title: group.title },
      lat: group.lat,
      lon: group.lon
    });
    if (commandId) {
      pendingControlCommands.set(commandId, {
        key: group.key,
        title: group.title,
        controlId: group.control.id,
        instanceId: group.instanceId,
        state: stateDefinition.id,
        value: stateDefinition.value,
        batchId: String(options.batchId || '')
      });
      if (!options.deferRender) renderHomebaseControls();
    }
    const message = commandId
      ? actionProgressMessage(group.control, stateDefinition.id)
      : `${group.control.label} konnte nicht gesteuert werden. Bitte prüfe die Verbindung zur VFR-Haupt-App und zum PC-Tracker.`;
    setControlResult(group.key, message, commandId ? null : false);
    setResult('previewResult', message, commandId ? null : false);
    log(commandId
      ? `homebase_v1.object.control.set gesendet (${commandId}, ${group.control.id}=${stateDefinition.id}).`
      : `${group.control.label}: Verbindung zur Haupt-App oder zum PC-Tracker fehlt.`, commandId ? 'info' : 'error');
    return !!commandId;
  }

  function requestGlobalControlState(kind, nextState) {
    const groups = activeControlGroups().filter((group) => (
      globalControlKind(group.control) === kind
      && group.control.states.some((stateDefinition) => stateDefinition.id === nextState)
    ));
    if (!groups.length || groups.some((group) => [...pendingControlCommands.values()].some((entry) => entry.key === group.key))) return false;
    const operation = {
      id: `global-${kind}-${Date.now()}-${++globalControlSequence}`,
      kind,
      state: nextState,
      total: groups.length,
      targetCount: groups.reduce((sum, group) => sum + group.count, 0),
      pending: 0,
      ok: 0,
      failed: 0,
      lastError: '',
      completedAt: 0
    };
    globalControlOperations.set(kind, operation);
    for (const group of groups) {
      if (requestObjectControlState(group, nextState, { batchId: operation.id, deferRender: true })) operation.pending += 1;
      else operation.failed += 1;
    }
    if (!operation.pending) operation.completedAt = Date.now();
    renderHomebaseControls();
    const label = kind === 'door' ? 'Tore' : 'Lichter';
    const action = kind === 'door'
      ? nextState === 'open' ? 'geöffnet' : 'geschlossen'
      : nextState === 'on' ? 'eingeschaltet' : 'ausgeschaltet';
    const message = operation.pending
      ? `${operation.targetCount} ${label} werden ${action} …`
      : `Keine ${label} konnten angesteuert werden.`;
    setResult('previewResult', message, operation.pending ? null : false);
    log(`${label}-Sammelbefehl: ${nextState}, ${operation.pending}/${operation.total} gesendet.`, operation.pending ? 'info' : 'error');
    return operation.pending > 0;
  }

  function reapplyAcknowledgedControlStates() {
    for (const group of activeControlGroups()) {
      const desiredState = acknowledgedControlStates.get(group.key);
      if (!desiredState) continue;
      if ([...pendingControlCommands.values()].some((entry) => entry.key === group.key)) continue;
      requestObjectControlState(group, desiredState, { preserveGlobalStatus: true });
    }
  }

  function scheduleControlStateReapply() {
    clearTimeout(controlReapplyTimer);
    controlReapplyTimer = setTimeout(() => {
      controlReapplyTimer = null;
      reapplyAcknowledgedControlStates();
    }, 350);
  }

  function handleControlAck(ack) {
    const commandId = String(ack?.commandId || '');
    if (handledControlAckIds.has(commandId)) return;
    const pending = pendingControlCommands.get(commandId);
    if (!pending) {
      log(`${ack?.type || 'control_ack'}: ACK mit unbekannter commandId ignoriert.`, 'error');
      return;
    }
    pendingControlCommands.delete(commandId);
    handledControlAckIds.add(commandId);
    if (handledControlAckIds.size > 100) handledControlAckIds.delete(handledControlAckIds.values().next().value);
    const ok = ack.status === 'ok';
    if (ok) {
      acknowledgedControlStates.set(pending.key, String(ack.state || ack.stateId || pending.state));
      saveState();
    }
    const operation = pending.batchId
      ? [...globalControlOperations.values()].find((entry) => entry.id === pending.batchId)
      : null;
    if (operation) {
      operation.pending = Math.max(0, operation.pending - 1);
      if (ok) operation.ok += 1;
      else {
        operation.failed += 1;
        operation.lastError = String(ack.message || 'Objekt konnte nicht gesteuert werden.');
      }
      if (!operation.pending) operation.completedAt = Date.now();
    }
    renderHomebaseControls();
    const group = activeControlGroups().find((entry) => entry.key === pending.key);
    const message = ok && group
      ? confirmedControlMessage(group.control, String(ack.state || ack.stateId || pending.state))
      : ack.message || 'Objekt konnte nicht gesteuert werden.';
    setControlResult(pending.key, message, ok);
    setResult('previewResult', message, ok);
    log(`${ack.type}: ${message}`, ok ? 'ok' : 'error');
  }

  function renderHomebaseControls() {
    const container = $('homebaseControls');
    const empty = $('homebaseControlsEmpty');
    if (!container || !empty) return;
    const groups = activeControlGroups();
    const panels = controlPanels(groups);
    container.textContent = '';
    empty.hidden = groups.length > 0;

    const globalDefinitions = [
      {
        kind: 'door',
        title: 'Alle Tore',
        singular: 'Tor',
        states: [
          { id: 'open', label: 'Alle Tore öffnen', confirmed: 'Bestätigt: Alle Tore geöffnet. Bereit.' },
          { id: 'closed', label: 'Alle Tore schließen', confirmed: 'Bestätigt: Alle Tore geschlossen. Bereit.' }
        ]
      },
      {
        kind: 'light',
        title: 'Alle Lichter',
        singular: 'Licht',
        states: [
          { id: 'on', label: 'Alle Lichter an', confirmed: 'Bestätigt: Alle Lichter an. Bereit.' },
          { id: 'off', label: 'Alle Lichter aus', confirmed: 'Bestätigt: Alle Lichter aus. Bereit.' }
        ]
      }
    ].map((definition) => ({
      ...definition,
      groups: groups.filter((group) => globalControlKind(group.control) === definition.kind)
    })).filter((definition) => definition.groups.length > 0);

    if (globalDefinitions.length) {
      const globalGrid = document.createElement('div');
      globalGrid.className = 'homebase-control-tile-grid homebase-control-tile-grid-global';
      globalGrid.setAttribute('aria-label', 'Gesamtsteuerung');
      for (const definition of globalDefinitions) {
        const operation = globalControlOperations.get(definition.kind) || null;
        const targetCount = definition.groups.reduce((sum, group) => sum + group.count, 0);
        const groupKeys = new Set(definition.groups.map((group) => group.key));
        const busy = (operation?.pending || 0) > 0
          || [...pendingControlCommands.values()].some((entry) => groupKeys.has(entry.key));
        const commonState = definition.states.find((stateDefinition) => (
          definition.groups.every((group) => knownControlState(group) === stateDefinition.id)
        ))?.id || '';
        const pendingState = operation?.pending ? operation.state : '';
        const control = {
          id: definition.kind === 'door' ? 'door' : 'light',
          type: definition.kind === 'light' ? 'light' : 'animation',
          states: definition.states
        };
        let status = controlTileStatus(control, commonState, pendingState);
        if (operation?.pending) {
          status = `${operation.ok + operation.failed}/${operation.total} bestätigt …`;
        } else if (operation?.failed) {
          status = `${operation.failed} fehlgeschlagen`;
        } else if (operation?.completedAt) {
          status = controlTileStatus(control, operation.state);
        }
        const tile = createControlTile({
          name: definition.title,
          functionLabel: `${targetCount} ${targetCount === 1 ? definition.singular : definition.title.replace(/^Alle /, '')}`,
          control,
          currentState: commonState || (operation?.completedAt ? operation.state : ''),
          pendingState,
          busy,
          status,
          onToggle: (nextState) => requestGlobalControlState(definition.kind, nextState)
        });
        tile.classList.add('homebase-control-tile-global');
        if (operation?.failed) tile.classList.add('has-error');
        globalGrid.append(tile);
      }
      const { category, body } = createControlCategory('global', 'Gesamtsteuerung', globalDefinitions.length);
      body.append(globalGrid);
      container.append(category);
    }

    if (!panels.length) return;

    const buildingPanels = panels.map((panel) => ({
      ...panel,
      groups: panel.groups.filter(isBuildingControlGroup)
    })).filter((panel) => panel.groups.length > 0);
    if (buildingPanels.length) {
      const buildingList = document.createElement('div');
      buildingList.className = 'homebase-building-control-list';
      buildingList.setAttribute('aria-label', 'Gebäudesteuerung: Tore links, Lampen rechts');
      for (const panel of buildingPanels) {
        const row = document.createElement('div');
        row.className = 'homebase-building-control-row';
        const doorGroups = panel.groups.filter((group) => controlVisualKind(group.control) === 'door');
        const lightGroups = panel.groups.filter((group) => controlVisualKind(group.control) === 'light');
        const otherGroups = panel.groups.filter((group) => !['door', 'light'].includes(controlVisualKind(group.control)));
        doorGroups.forEach((group) => row.append(createGroupControlTile(group, panel)));
        lightGroups.forEach((group) => {
          const tile = createGroupControlTile(group, panel);
          if (!doorGroups.length) tile.classList.add('homebase-building-light-only');
          row.append(tile);
        });
        otherGroups.forEach((group) => row.append(createGroupControlTile(group, panel)));
        buildingList.append(row);
      }
      const buildingControlCount = buildingPanels.reduce((sum, panel) => sum + panel.groups.length, 0);
      const { category, body } = createControlCategory('buildings', 'Gebäude', buildingControlCount);
      body.append(buildingList);
      container.append(category);
    }

    const lightingPanels = panels.map((panel) => ({
      ...panel,
      groups: panel.groups.filter((group) => !isBuildingControlGroup(group) && controlVisualKind(group.control) === 'light')
    })).filter((panel) => panel.groups.length > 0);
    if (lightingPanels.length) {
      const lightingGrid = document.createElement('div');
      lightingGrid.className = 'homebase-control-tile-grid homebase-control-tile-grid-lighting';
      lightingGrid.setAttribute('aria-label', 'Eigenständige Beleuchtung');
      for (const panel of lightingPanels) {
        panel.groups.forEach((group) => lightingGrid.append(createGroupControlTile(group, panel)));
      }
      const lightingControlCount = lightingPanels.reduce((sum, panel) => sum + panel.groups.length, 0);
      const { category, body } = createControlCategory('lighting', 'Beleuchtung', lightingControlCount);
      body.append(lightingGrid);
      container.append(category);
    }

    const otherPanels = panels.map((panel) => ({
      ...panel,
      groups: panel.groups.filter((group) => (
        !isBuildingControlGroup(group)
        && controlVisualKind(group.control) !== 'light'
      ))
    })).filter((panel) => panel.groups.length > 0);
    if (otherPanels.length) {
      const otherGrid = document.createElement('div');
      otherGrid.className = 'homebase-control-tile-grid homebase-control-tile-grid-other';
      otherGrid.setAttribute('aria-label', 'Weitere Objektsteuerungen');
      for (const panel of otherPanels) {
        panel.groups.forEach((group) => otherGrid.append(createGroupControlTile(group, panel)));
      }
      const otherControlCount = otherPanels.reduce((sum, panel) => sum + panel.groups.length, 0);
      const { category, body } = createControlCategory('other', 'Weitere Steuerungen', otherControlCount);
      body.append(otherGrid);
      container.append(category);
    }
  }

  function syncInputsFromState() {
    state.hangar.objectTitle = normalizeHangarTitle(state.hangar.objectTitle);
    const footprint = hangarFootprintFor(state.hangar.objectTitle);
    state.hangar.widthM = footprint.widthM;
    state.hangar.depthM = footprint.depthM;
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
    $('hangarWidth').value = footprint.widthM;
    $('hangarDepth').value = footprint.depthM;
    $('hangarSelect').value = state.hangar.objectTitle;
    const sizeText = footprint.widthM === footprint.depthM ? `Das Modell hat einen Durchmesser von ${footprint.widthM} m.` : `Das Modell ist ${footprint.widthM} × ${footprint.depthM} m groß.`;
    $('hangarWidth').title = sizeText;
    $('hangarDepth').title = sizeText;
    const footprintHint = $('hangarFootprintHint');
    if (footprintHint) footprintHint.textContent = `${sizeText} Die Abmessungen sind fest vorgegeben. Mit „Hangar höher / tiefer“ gleichst du nur kleine Unebenheiten im Gelände aus.`;
    $('crewShareToggle').checked = syncMeta.crewShareEnabled === true;
    $('doorAutomationToggle').checked = state.doorAutomationEnabled !== false;
    renderObjectList();
    renderPeople();
    renderHomebaseControls();
  }

  function updateObjectMarkers() {
    const currentIds = new Set(state.objects.map((item) => item.id));
    objectMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        objectMarkers.delete(id);
        const headingLineLayer = objectHeadingLines.get(id);
        if (headingLineLayer) map.removeLayer(headingLineLayer);
        objectHeadingLines.delete(id);
      }
    });
    state.objects.forEach((item, index) => {
      const catalog = CATALOG_BY_TITLE.get(item.title);
      let marker = objectMarkers.get(item.id);
      let headingLineLayer = objectHeadingLines.get(item.id);
      if (!marker) {
        const markerId = item.id;
        marker = L.marker(objectPosition(item), { icon: markerIcon('object-icon', String(index + 1)), draggable: true }).addTo(map);
        marker.on('click', (event) => { L.DomEvent.stopPropagation(event); selectObject(markerId); });
        marker.on('dragend', () => {
          const currentItem = state.objects.find((entry) => entry.id === markerId);
          if (!currentItem) { updateMap(); return; }
          if (!confirmCompiledChange(markerId, currentItem.label || 'Dieses Objekt')) return;
          const point = marker.getLatLng();
          const offset = localOffsetMeters(state.spawn.lat, state.spawn.lon, point.lat, point.lng);
          currentItem.northM = offset.northM; currentItem.eastM = offset.eastM;
          selectedObjectId = markerId;
          saveState(); syncInputsFromState(); updateMap(); scheduleLiveObjectMove(currentItem);
        });
        objectMarkers.set(item.id, marker);
      }
      const position = objectPosition(item);
      if (!headingLineLayer) {
        headingLineLayer = L.polyline([], { color: '#54d7d0', weight: 2, opacity: .7, interactive: false }).addTo(map);
        objectHeadingLines.set(item.id, headingLineLayer);
      }
      const selected = item.id === selectedObjectId;
      headingLineLayer.setLatLngs(headingLine(position.lat, position.lng, item.heading, objectHeadingLineLengthM(position.lat)));
      headingLineLayer.setStyle({ weight: selected ? 3 : 2, opacity: selected ? 1 : .7 });
      marker.setLatLng(position);
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
    updateRouteDebugTargets();
    if (routeDebugEnabled) planRouteDebug();
    renderSelectedPersonRoute();
  }

  map.on('zoomend', updateObjectMarkers);

  function readSpawnStateFromInputs() {
    const next = {
      lat: clamp($('spawnLat').value, -90, 90),
      lon: clamp($('spawnLon').value, -180, 180),
      altFt: finite($('spawnAlt').value, state.spawn.altFt),
      heading: normalizeHeading($('spawnHeading').value)
    };
    const changed = next.lat !== state.spawn.lat || next.lon !== state.spawn.lon || next.altFt !== state.spawn.altFt || next.heading !== normalizeHeading(state.spawn.heading);
    if (changed && !confirmCompiledBaseMove()) return;
    state.spawn.lat = next.lat;
    state.spawn.lon = next.lon;
    state.spawn.altFt = next.altFt;
    state.spawn.heading = next.heading;
    state.spawn.mode = 'airport_parking';
    saveState(); syncInputsFromState(); updateMap();
    invalidateLivePreview();
  }

  function readHangarStateFromInputs(event) {
    const next = {
      northM: clamp($('hangarNorth').value, -1000, 1000),
      eastM: clamp($('hangarEast').value, -1000, 1000),
      heading: normalizeHeading($('hangarHeading').value),
      heightFt: clamp($('hangarHeight').value, -50, 200)
    };
    const transformChanged = next.northM !== state.hangar.northM || next.eastM !== state.hangar.eastM || next.heading !== normalizeHeading(state.hangar.heading) || next.heightFt !== state.hangar.heightFt;
    if (transformChanged && !confirmCompiledChange('hangar', 'Der Hangar')) return;
    state.hangar.northM = next.northM;
    state.hangar.eastM = next.eastM;
    state.hangar.heading = next.heading;
    state.hangar.heightFt = next.heightFt;
    state.hangar.widthM = clamp($('hangarWidth').value, 4, 80);
    state.hangar.depthM = clamp($('hangarDepth').value, 4, 100);
    state.hangar.objectTitle = normalizeHangarTitle($('hangarSelect').value || state.hangar.objectTitle);
    saveState(); syncInputsFromState(); updateMap();
    if (!['hangarWidth', 'hangarDepth'].includes(event?.target?.id)) scheduleLiveHangarMove();
  }

  function readSelectedObjectFromInputs(event) {
    const item = selectedObject();
    if (!item) return;
    const next = {
      northM: clamp($('objectNorth').value, -2000, 2000),
      eastM: clamp($('objectEast').value, -2000, 2000),
      heading: normalizeHeading($('objectHeading').value),
      heightFt: clamp($('objectHeight').value, -20, 200),
      scale: clamp($('objectScale').value, .1, 10)
    };
    const changed = next.northM !== item.northM || next.eastM !== item.eastM || next.heading !== normalizeHeading(item.heading) || next.heightFt !== item.heightFt || next.scale !== item.scale;
    if (changed && !confirmCompiledChange(item.id, item.label || 'Dieses Objekt')) return;
    item.northM = next.northM;
    item.eastM = next.eastM;
    item.heading = next.heading;
    item.heightFt = next.heightFt;
    item.scale = next.scale;
    saveState(); syncInputsFromState(); updateMap();
    if (event?.target?.id === 'objectScale') {
      setResult('previewResult', 'Die neue Objektgröße wird übernommen, sobald du die Homebase im Simulator neu anzeigen lässt.');
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
    state.people.forEach((person) => { person.stops = person.stops.filter((stop) => stop.targetType !== 'object' || stop.targetId !== removed.id); });
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
      doorAutomationEnabled: state.doorAutomationEnabled !== false,
      spawn: { lat: state.spawn.lat, lon: state.spawn.lon, altFt: state.spawn.altFt, heading: normalizeHeading(state.spawn.heading), mode: 'airport_parking' },
      hangar: {
        lat: hp.lat, lon: hp.lng, altFt: state.spawn.altFt + state.hangar.heightFt,
        heightOffsetFt: state.hangar.heightFt, heading: normalizeHeading(state.hangar.heading + headingCorrectionFor(state.hangar.objectTitle)),
        widthM: state.hangar.widthM, depthM: state.hangar.depthM, objectTitle: normalizeHangarTitle(state.hangar.objectTitle)
      },
      objects: state.objects.map((item) => {
        const position = objectPosition(item);
        return {
          id: item.id, title: item.title, label: item.label,
          lat: position.lat, lon: position.lng,
          altFt: state.spawn.altFt + item.heightFt, heightOffsetFt: item.heightFt,
          heading: normalizeHeading(item.heading + headingCorrectionFor(item.title)), scale: item.scale
        };
      }),
      people: state.people.map((person) => ({
        id: person.id, title: person.title, label: person.label,
        startNorthM: person.startNorthM, startEastM: person.startEastM, speedKts: person.speedKts,
        targetMode: person.randomTargets === true ? 'all-objects' : 'manual',
        destinations: personRuntimeDestinations(person)
      })),
      controlStates: serializeAcknowledgedControlStates(),
      navigation: {
        spawn: { lat: state.spawn.lat, lon: state.spawn.lon, altFt: state.spawn.altFt, heading: state.spawn.heading },
        hangar: routeHangarBoundary(),
        hangars: routeHangarBoundaries(),
        obstacles: routeDebugObstacles()
      }
    };
  }

  function selectedCompileMode() {
    return $('compileSpawnOnlyToggle')?.checked === true ? 'spawn-only' : 'full';
  }

  function buildPackageConfig() {
    return { ...buildConfig(), compileMode: selectedCompileMode() };
  }

  function syncCompileModeUi() {
    const spawnOnly = selectedCompileMode() === 'spawn-only';
    $('compileModeHint').textContent = spawnOnly
      ? 'Der Mod enthält nur den startbaren Parkplatz. Hangar, Ausstattung und Personen bleiben vollständig live editierbar und werden durch App oder Tracker aufgebaut; feste Kollisionsmodelle sind in diesem Modus nicht enthalten.'
      : 'Der vollständige Mod enthält Startplatz, Hangar und Ausstattung. Änderungen an kompilierten Objekten werden erst nach einer erneuten Kompilierung vollständig sichtbar.';
  }

  function compiledRuntimeObject(id) {
    if (!installedCompiledConfig) return null;
    if (installedCompiledConfig.compileMode === 'spawn-only') return null;
    if (id === 'hangar' && installedCompiledConfig.hangar) {
      return { id: 'hangar', title: installedCompiledConfig.hangar.objectTitle, ...installedCompiledConfig.hangar };
    }
    return (Array.isArray(installedCompiledConfig.objects) ? installedCompiledConfig.objects : [])
      .find((item) => String(item?.id || '') === String(id || '')) || null;
  }

  function confirmCompiledChange(id, label = 'Dieses Objekt') {
    const key = String(id || '');
    if (!key || approvedCompiledChanges.has(key)) return true;
    const compiled = compiledRuntimeObject(key);
    if (!compiled) return true;
    const accepted = window.confirm(
      `${label} ist Bestandteil des aktuell installierten Homebase-Mods.\n\n` +
      'Wenn du Position, Höhe, Ausrichtung oder Größe jetzt änderst, kann im Simulator vorübergehend eine zweite Kopie erscheinen. ' +
      'Das alte kompilierte Objekt verschwindet erst, nachdem du die Homebase erneut kompiliert und installiert hast.\n\n' +
      'Änderung trotzdem ausführen?'
    );
    if (accepted) {
      approvedCompiledChanges.add(key);
      return true;
    }
    setResult('previewResult', `${label} wurde nicht verändert. Der installierte Mod bleibt unverändert.`, true);
    syncInputsFromState();
    updateMap();
    return false;
  }

  function confirmCompiledBaseMove() {
    if (!installedCompiledConfig) return true;
    const spawnOnly = installedCompiledConfig.compileMode === 'spawn-only';
    const keys = spawnOnly
      ? ['spawn']
      : ['hangar', ...(Array.isArray(installedCompiledConfig.objects) ? installedCompiledConfig.objects.map((item) => String(item?.id || '')).filter(Boolean) : [])];
    if (keys.every((key) => approvedCompiledChanges.has(key))) return true;
    const accepted = window.confirm(
      (spawnOnly
        ? 'Der Startpunkt gehört zum aktuell installierten Startplatz-Mod. Eine Änderung verschiebt nur den Live-Entwurf; der startbare Parkplatz bleibt bis zur nächsten Kompilierung an seiner bisherigen Position.\n\n'
        : 'Der Startpunkt gehört zum aktuell installierten Homebase-Mod. Eine Änderung verschiebt den aktuellen Entwurf gegenüber allen kompilierten Objekten.\n\n' +
          'Dadurch können im Simulator vorübergehend doppelte beziehungsweise veraltete Objekte erscheinen. Der alte Stand verschwindet erst nach erneutem Kompilieren und Installieren.\n\n') +
      'Startpunkt trotzdem verschieben?'
    );
    if (accepted) {
      for (const key of keys) approvedCompiledChanges.add(key);
      return true;
    }
    setResult('previewResult', 'Der Startpunkt wurde nicht verändert. Der installierte Mod bleibt unverändert.', true);
    syncInputsFromState();
    updateMap();
    return false;
  }

  function sendCommand(type, extra = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      log(`${type}: Verbindung zur Haupt-App oder zum PC-Tracker fehlt.`, 'error');
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

  function schedulePeopleLiveSync() {
    clearTimeout(peopleLiveSyncTimer);
    peopleLiveSyncTimer = setTimeout(() => {
      peopleLiveSyncTimer = null;
      const config = buildConfig();
      sendStabilizerCommand('homebase_v1.preview.people.sync', {
        people: config.people,
        navigation: config.navigation
      });
    }, 120);
  }

  function invalidateLivePreview() {
    livePreviewReady = false;
    liveObjectIds.clear();
    clearTimeout(controlReapplyTimer);
    controlReapplyTimer = null;
    pendingControlCommands.clear();
    globalControlOperations.clear();
    for (const timer of liveMoveTimers.values()) clearTimeout(timer);
    liveMoveTimers.clear();
    renderHomebaseControls();
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
        setResult('previewResult', 'Der Hangar wurde im Entwurf verschoben. Für die sofortige Anzeige im Simulator muss der PC-Tracker verbunden sein.', false);
      }
    }, INTEGRATED || livePreviewReady);
  }

  function scheduleLiveObjectMove(item) {
    if (!item) return;
    if (PERSISTENT_ONLY_TITLES.has(item.title)) {
      setResult('previewResult', `${item.label} wird gespeichert, erscheint aber erst im kompilierten Homebase-Mod.`);
      return;
    }
    queueLiveMove(item.id, () => {
      const object = buildConfig().objects.find((entry) => entry.id === item.id);
      const commandId = object && sendStabilizerCommand('homebase_v1.preview.object.move', { object });
      if (!commandId) {
        setResult('previewResult', `${item.label} wurde im Entwurf verschoben. Für die sofortige Anzeige im Simulator muss der PC-Tracker verbunden sein.`, false);
        return;
      }
      pendingLiveObjectMoves.set(commandId, object);
    }, true);
  }

  function sendLiveObjectAdd(item) {
    if (!item) return;
    if (PERSISTENT_ONLY_TITLES.has(item.title)) {
      setResult('previewResult', `${item.label} wird gespeichert und erscheint erst im kompilierten Homebase-Mod.`);
      return;
    }
    const object = buildConfig().objects.find((entry) => entry.id === item.id);
    if (!object || !sendStabilizerCommand('homebase_v1.preview.object.add', { object })) {
      setResult('previewResult', `${item.label} wurde gespeichert. Für die sofortige Anzeige im Simulator muss der PC-Tracker verbunden sein.`, false);
      return;
    }
    setResult('previewResult', `${item.label} wird im Simulator angezeigt …`);
  }

  function spawnProbeObject() {
    return {
      id: SPAWN_PROBE_ID,
      title: SPAWN_PROBE_TITLE,
      label: 'Gelber Startpunkt-Messkegel',
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
      setResult('previewResult', 'Der Startpunkt wurde gespeichert. Zum Anzeigen des gelben Kegels muss der PC-Tracker verbunden sein.', false);
      return;
    }
    pendingProbeMoveCommandId = commandId;
    setResult('previewResult', 'Der gelbe Kegel wird zum Startpunkt bewegt und die Bodenhöhe wird gemessen …');
  }

  function addSpawnProbe() {
    if (!sendStabilizerCommand('homebase_v1.preview.object.add', { object: spawnProbeObject() })) {
      setResult('previewResult', 'Der Startpunkt wurde gespeichert. Zum Anzeigen des gelben Kegels muss der PC-Tracker verbunden sein.', false);
      return;
    }
    setResult('previewResult', 'Der gelbe Kegel wird am Startpunkt angezeigt …');
  }

  function beginPreviewTeardown(kind, payload = null) {
    const commandId = sendStabilizerCommand('homebase_v1.preview.extras.clear');
    if (!commandId) return false;
    previewTeardown = { commandId, kind, payload };
    clearTimeout(previewWatchdog);
    previewWatchdog = setTimeout(() => {
      if (previewTeardown?.commandId !== commandId) return;
      previewTeardown = null;
      setResult('previewResult', 'Die Live-Vorschau konnte nicht vollständig ausgeblendet werden. Bitte prüfe die Verbindung zum PC-Tracker und versuche es erneut.', false);
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
      setResult('previewResult', `Die Live-Vorschau konnte nicht vollständig ausgeblendet werden.${detail}`, false);
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
      setResult('previewResult', 'Die vorübergehende Live-Vorschau wurde ausgeblendet. Dein Entwurf bleibt gespeichert.', true);
      releasePreviewQueue();
    }
  }

  function beginPrimaryTeardown(transition) {
    const id = sendCommand('homebase_v1.preview.clear');
    if (!id) {
      previewQueued = false;
      clearQueued = false;
      setResult('previewResult', 'Die Live-Vorschau konnte nicht ausgeblendet werden, weil der PC-Tracker nicht erreichbar ist.', false);
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
      setResult('previewResult', 'Die Live-Vorschau konnte nicht vollständig ausgeblendet werden. Bitte versuche es erneut.', false);
    }, 35000);
    setResult('previewResult', 'Objekte sind ausgeblendet; der Hangar wird noch entfernt …');
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
      setResult('previewResult', 'Die Homebase konnte nicht im Simulator angezeigt werden. Bitte prüfe PC-Tracker und MSFS.', false);
      return;
    }
    const persistentNote = payload.persistentObjects.length ? ` ${payload.persistentObjects.length} Objekt(e) erscheinen erst im kompilierten Mod.` : '';
    setResult('previewResult', `${hangar.label} und ${state.objects.length - payload.persistentObjects.length} Objekt(e) werden im Simulator angezeigt …${persistentNote}`);
  }

  function sendPreview() {
    if (INTEGRATED) {
      window.parent.postMessage({ channel: 'vfr-homebase', kind: 'owner-auto-refresh' }, PARENT_ORIGIN);
      setResult('previewResult', 'Die automatische Homebase-Ergänzung wird anhand des installierten Mod-Stands neu aufgebaut …');
      return;
    }
    if (previewInFlightId || previewTeardown || primaryTeardown) {
      previewQueued = true;
      clearQueued = false;
      setResult('previewResult', 'Die Live-Vorschau wird bereits aktualisiert. Deine letzte Änderung wird direkt danach übernommen.');
      return;
    }
    invalidateLivePreview();
    const fullConfig = buildConfig();
    const companionObjects = fullConfig.objects.filter((item) => COMPANION_TITLES.has(item.title));
    const persistentObjects = fullConfig.objects.filter((item) => PERSISTENT_ONLY_TITLES.has(item.title));
    const trackerConfig = { ...fullConfig, objects: fullConfig.objects.filter((item) => !COMPANION_TITLES.has(item.title) && !PERSISTENT_ONLY_TITLES.has(item.title)) };
    previewQueued = false;
    if (beginPreviewTeardown('set', { trackerConfig, companionObjects, persistentObjects })) {
      setResult('previewResult', 'Die bisherige Live-Vorschau wird kurz ausgeblendet und danach neu aufgebaut …');
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
    if (INTEGRATED) {
      window.parent.postMessage({ channel: 'vfr-homebase', kind: 'owner-auto-clear' }, PARENT_ORIGIN);
      setResult('previewResult', 'Die automatische Homebase-Ergänzung wird bis zum Verlassen des Homebase-Radius ausgeblendet …');
      return;
    }
    if (previewInFlightId || previewTeardown || primaryTeardown) {
      clearQueued = true;
      previewQueued = false;
      setResult('previewResult', 'Die Live-Vorschau wird ausgeblendet, sobald die laufende Aktualisierung fertig ist.');
      return;
    }
    if (beginPreviewTeardown('clear')) setResult('previewResult', 'Die vorübergehende Live-Vorschau wird aus dem Simulator entfernt …');
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
      setResult('assetPackageResult', 'Die Homebase-Objekte können erst geprüft werden, wenn der PC-Tracker verbunden ist.', null);
      return;
    }
    if (localAssetInspection.updateAvailable) {
      const installed = localAssetInspection.packageComplete
        ? `Installiert: ${localAssetInspection.packageVersion}.`
        : 'Die benötigten Homebase-Objekte sind noch nicht vollständig installiert.';
      const sizeMb = Number(localAssetInspection.remoteArchiveSize || 0) / 1024 / 1024;
      const size = sizeMb > 0 ? ` Download: ${sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} MB.` : '';
      setResult('assetPackageResult', `${installed} Eine neuere Version ${localAssetInspection.remoteVersion} ist verfügbar.${size}`, false);
      $('assetPackageBtn').textContent = `Homebase-Objekte auf ${localAssetInspection.remoteVersion} aktualisieren`;
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
      setResult('assetPackageResult', `Die Homebase-Objekte ${localAssetInspection.packageVersion} sind vollständig installiert.${community}${remote}`, true);
      $('assetPackageBtn').textContent = 'Homebase-Objekte erneut prüfen';
      return;
    }
    const found = localAssetInspection.communityFound
      ? `Installiert ist ${localAssetInspection.packageVersion || 'eine unvollständige Version'}.`
      : 'Die benötigten Homebase-Objekte sind noch nicht installiert.';
    const fallback = ' Der PC-Tracker lädt das geprüfte Paket bei Bedarf aus dem Releasekanal.';
    const detection = localAssetInspection.communityDetectionError
      ? ` ${localAssetInspection.communityDetectionError}`
      : '';
    setResult('assetPackageResult', `${found}${fallback}${detection}`, false);
    $('assetPackageBtn').textContent = 'Homebase-Objekte prüfen oder installieren';
  }

  async function offerAssetPackageInstall(options = {}) {
    const force = options.force === true;
    if (!INTEGRATED) {
      await refreshLocalAssetInspection();
      log('Die Homebase-Objekte können über die VFR-Haupt-App und den PC-Tracker geprüft oder installiert werden.');
      return;
    }
    if (assetInstallCheckInFlight) return;
    assetInstallCheckInFlight = true;
    const button = $('assetPackageBtn');
    button.disabled = true;
    try {
      const inspection = await refreshLocalAssetInspection({ remote: true, force });
      if (!inspection) throw new Error('Der PC-Tracker konnte den Zustand der Homebase-Objekte nicht ermitteln.');
      if (inspection.packageComplete && !inspection.updateAvailable) {
        if (force) log(`Die Homebase-Objekte ${inspection.packageVersion} sind bereits aktuell.`, 'ok');
        if (force && inspection.remoteError) log(`Remote-Prüfung nicht möglich; installierte Version bleibt unverändert: ${inspection.remoteError}`, 'error');
        return;
      }
      const useRemote = inspection.remoteAvailable === true && inspection.updateAvailable === true;
      if (!useRemote) {
        throw new Error(inspection.remoteError || 'Der Asset-Releasekanal ist derzeit nicht erreichbar.');
      }
      const availableVersion = inspection.remoteVersion;
      const signature = `${inspection.packageVersion || 'missing'}>remote:${availableVersion}`;
      if (!force && assetPromptedSignature === signature) return;
      assetPromptedSignature = signature;
      const current = inspection.communityFound
        ? `Installierte Version: ${inspection.packageVersion || 'unvollständig'}`
        : 'Noch keine Version installiert';
      const sizeMb = Number(inspection.remoteArchiveSize || 0) / 1024 / 1024;
      const changed = Array.isArray(inspection.changedAssets) && inspection.changedAssets.length
        ? `\nGeänderte Assets: ${inspection.changedAssets.join(', ')}`
        : '';
      const source = `Verfügbar auf dem Assetserver: ${availableVersion}\nDownloadgröße: ${sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} MB${changed}`;
      const confirmed = window.confirm(
        `Die Modelle für deine Homebase fehlen oder sind veraltet.\n\n${current}\n${source}\n\n` +
        'Sollen die geprüften Homebase-Objekte jetzt in den aktiven MSFS-Community-Ordner installiert werden? Der PC-Tracker kontrolliert Download und Inhalt vor jeder Änderung.'
      );
      if (!confirmed) {
        log('Die Installation der Homebase-Objekte wurde pausiert.');
        return;
      }
      const simulator = await requestJson('/api/simulator/status');
      if (simulator.running) {
        const stopConfirmed = window.confirm(
          'MSFS läuft noch. Damit die Homebase-Objekte sicher ersetzt und beim nächsten Start geladen werden, muss der Simulator geschlossen werden.\n\n' +
          'Nicht gespeicherter Flugfortschritt kann verloren gehen. MSFS jetzt schließen und die Homebase-Objekte installieren?'
        );
        if (!stopConfirmed) {
          log('Assetinstallation pausiert; MSFS wurde nicht beendet.');
          return;
        }
        await postJson('/api/simulator/stop', { confirmed: true });
        log('MSFS wurde nach Bestätigung für die Assetinstallation geschlossen.', 'ok');
      }
      setResult('assetPackageResult', `Die Homebase-Objekte ${availableVersion} werden heruntergeladen, geprüft und installiert …`);
      const installed = await postJson('/api/assets/update-install', { confirmed: true });
      await refreshLocalAssetInspection({ remote: true });
      log(installed.message || `Homebase-Objekte ${installed.packageVersion || ''} installiert.`, 'ok');
      const installPath = installed.communityPath ? ` Ziel: ${installed.communityPath}.` : '';
      setResult('assetPackageResult', `${installed.message || 'Die Homebase-Objekte wurden installiert.'}${installPath} Starte MSFS anschließend neu.`, true);
    } catch (error) {
      setResult('assetPackageResult', `Die Homebase-Objekte konnten nicht installiert werden: ${error?.message || error}`, false);
      log(`Homebase-Objekte konnten nicht installiert werden: ${error?.message || error}`, 'error');
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
    const packageConfig = buildPackageConfig();
    const spawnOnly = packageConfig.compileMode === 'spawn-only';
    try {
      showBuildStage('project', spawnOnly ? 'Der startbare Parkplatz wird für die Mod-Erstellung vorbereitet …' : 'Deine aktuelle Homebase wird für die Mod-Erstellung vorbereitet …');
      const prepared = await postJson('/api/package/prepare', { config: packageConfig });
      log(prepared.message || 'Homebase-Projekt erstellt.', 'ok');

      const sdk = await requestJson('/api/sdk/status');
      if (!sdk.installed) {
        const error = new Error('Das kostenlose Zusatzprogramm für die Mod-Erstellung wurde nicht gefunden. Öffne die Anleitung unten, installiere das MSFS 2024 SDK und starte diesen Schritt danach erneut.');
        error.code = 'SDK_MISSING';
        throw error;
      }

      showBuildStage('simulator', 'Die Homebase ist vorbereitet. Jetzt wird geprüft, ob MSFS für die Kompilierung geschlossen werden muss …');
      const simulator = await requestJson('/api/simulator/status');
      if (simulator.running) {
        const confirmed = window.confirm(`${spawnOnly ? 'Dein Startplatz' : 'Deine Homebase'} ist für die Kompilierung vorbereitet.\n\nDamit daraus ein Mod entstehen kann, muss MSFS jetzt beendet werden. Nicht gespeicherter Flugfortschritt kann dabei verloren gehen.\n\nMSFS jetzt schließen und ${spawnOnly ? 'den Startplatz' : 'die Homebase'} kompilieren?`);
        if (!confirmed) {
          showBuildStage('simulator', 'Pausiert: MSFS wurde nicht beendet. Deine Vorbereitung ist gespeichert; du kannst die Kompilierung später erneut starten.');
          log('Homebase-Kompilierung vor dem Beenden von MSFS durch den Benutzer pausiert.');
          return;
        }
        showBuildStage('simulator', 'MSFS wird geschlossen. Bitte einen Moment warten …');
        const stopping = await postJson('/api/simulator/stop', { confirmed: true });
        log(stopping.message || 'Das Beenden von MSFS wurde angefordert.', 'ok');
      } else {
        log('MSFS war bereits geschlossen.', 'ok');
      }

      showBuildStage('sdk', 'Der PC-Tracker wartet, bis MSFS vollständig beendet ist, und kompiliert danach deine Homebase …');
      const built = await postJson('/api/package/build', { config: packageConfig });
      const waited = Number(built.simulatorExit?.waitedMs || 0);
      log(`${built.message || 'Homebase-Paket gebaut.'}${waited > 0 ? ` Nach ${Math.round(waited / 1000)} Sekunde(n) Wartezeit auf MSFS.` : ''}`, 'ok');

      showBuildStage('install', `${spawnOnly ? 'Der Startplatz-Mod' : 'Der vollständige Homebase-Mod'} wurde kompiliert und kann jetzt installiert werden.`);
      const installConfirmed = window.confirm(`${spawnOnly ? 'Dein Startplatz-Mod' : 'Dein Homebase-Mod'} wurde erfolgreich kompiliert.\n\nSoll er jetzt in den aktiven MSFS-Community-Ordner installiert werden? Eine ältere Version deiner Homebase wird dabei ersetzt.`);
      if (!installConfirmed) {
        showBuildStage('install', 'Pausiert: Der fertige Homebase-Mod wurde noch nicht installiert. Du kannst den Assistenten später erneut starten.');
        log('Installation des gebauten Homebase-Pakets durch den Benutzer pausiert.');
        return;
      }

      showBuildStage('install', 'Eine ältere Homebase-Version wird ersetzt und der neue Mod in den Community-Ordner installiert …');
      const installed = await postJson('/api/package/install', { confirmed: true });
      if (installed.snapshotTrusted && installed.installedSnapshot?.config) {
        installedCompiledConfig = installed.installedSnapshot.config;
        installedCompiledSignature = JSON.stringify(installedCompiledConfig);
        approvedCompiledChanges.clear();
      }
      log(installed.message || 'Homebase-Mod installiert.', 'ok');
      showBuildStage('done', spawnOnly
        ? 'Fertig: Der Startplatz-Mod ist installiert. Nach dem Neustart von MSFS ist die Homebase als Startplatz verfügbar; Hangar, Ausstattung und Personen bleiben live über App oder Tracker editierbar.'
        : 'Fertig: Der Homebase-Mod ist installiert. Nach dem Neustart von MSFS bleibt die Homebase auch ohne laufendes Tool sichtbar und steht als Startplatz bereit.', 'complete');
    } catch (error) {
      const active = document.querySelector('[data-build-step].active')?.dataset.buildStep || 'project';
      showBuildStage(active, `Die Kompilierung wurde gestoppt: ${error?.message || error}`, 'failed');
      if (error?.code === 'SDK_MISSING' || String(error?.message || '').toLowerCase().includes('package tool')) $('sdkHelp').open = true;
      log(`Homebase-Kompilierung: ${error?.message || error}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function uninstallAirport() {
    const confirmed = window.confirm(
      'Soll der installierte Homebase-Mod wirklich aus dem MSFS-Community-Ordner gelöscht werden?\n\n' +
      'Die Homebase-Objekte, die Workbench und dein gespeicherter Entwurf bleiben erhalten. ' +
      'Damit die Änderung im Simulator wirksam wird, muss MSFS anschließend neu gestartet werden.'
    );
    if (!confirmed) {
      log('Homebase-Deinstallation wurde abgebrochen.');
      return;
    }
    const button = $('uninstallAirportBtn');
    button.disabled = true;
    setResult('packageResult', 'Der installierte Homebase-Mod wird aus dem Community-Ordner entfernt …');
    try {
      const result = await postJson('/api/package/uninstall', { confirmed: true });
      installedCompiledConfig = null;
      installedCompiledSignature = '';
      approvedCompiledChanges.clear();
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
      setPill('relayPill', 'Haupt-App wird verbunden …', 'warn');
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
          if (message.kind === 'theme-change') {
            applyWorkbenchTheme(message.theme);
            return;
          }
          if (message.kind === 'environment-opened') {
            environmentOpened = true;
            offerAssetPackageInstall().catch(() => {});
            return;
          }
          if (message.kind === 'sync-status') {
            setPill('syncPill', message.text || 'Cloud-Sync', message.status || 'muted');
            return;
          }
          if (message.kind === 'compiled-snapshot') {
            const nextConfig = message.snapshotTrusted === true ? message.snapshot?.config || null : null;
            const nextSignature = nextConfig ? JSON.stringify(nextConfig) : '';
            if (nextSignature !== installedCompiledSignature) approvedCompiledChanges.clear();
            installedCompiledSignature = nextSignature;
            installedCompiledConfig = nextConfig;
            return;
          }
          if (message.kind === 'owner-auto-status') {
            const stats = message.stats || {};
            const changed = Number(stats.changedCompiled || 0);
            const stale = Number(stats.staleCompiled || 0);
            const suffix = changed || stale
              ? ` ${changed + stale} Änderung(en) am kompilierten Stand benötigen für eine vollständig saubere Base eine erneute Kompilierung.`
              : '';
            livePreviewReady = message.status === 'ok' && message.active === true;
            setResult('previewResult', `${message.message || 'Automatische Homebase-Ergänzung aktualisiert.'}${suffix}`, message.status === 'ok' ? true : message.status === 'bad' ? false : null);
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
            const savedPlan = message.savedPlan;
            const savedCrewShareEnabled = message.savedCrewShareEnabled === true;
            const serverMatchesSavedDraft = finite(record.schemaVersion, 1) >= 2
              && !!record.plan
              && !!savedPlan
              && plansEqual(record.plan, savedPlan)
              && (record.crewShareEnabled === true) === savedCrewShareEnabled;
            if (!serverMatchesSavedDraft) {
              syncMeta.dirty = true;
              persistSyncMeta();
              postSyncDraft({ suppressAutoSave: true });
              setPill('syncPill', 'Cloud-Datensatz unvollständig', 'bad');
              log('Der Cloud-Server hat den Homebase-Plan nicht vollständig zurückgegeben. Der lokale Stand mit Personen und Routen bleibt erhalten und wartet auf einen vollständigen Cloud-Abgleich.', 'error');
              return;
            }
            if (syncMeta.localUpdatedAt <= finite(message.savedClientUpdatedAt, finite(record.clientUpdatedAt, syncMeta.localUpdatedAt))) syncMeta.dirty = false;
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
      setPill('relayPill', 'Verbindung wird vorbereitet …', 'warn');
      try { await fetch('https://websocketrelais.onrender.com/', { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(8000) }); } catch (_) {}
      setPill('relayPill', 'Verbindung wird aufgebaut …', 'warn');
      socket = new WebSocket(RELAY_URL);
    }
    socket.onopen = () => {
      setPill('relayPill', INTEGRATED ? 'Haupt-App verbunden' : 'Verbindung bereit', 'ok');
      if (!INTEGRATED && (!STANDALONE_ID || !STANDALONE_PIN)) {
        setPill('relayPill', 'Bitte über Haupt-App öffnen', 'warn');
        log('Öffne die Workbench über die VFR-Haupt-App. Dort werden deine Zugangsdaten automatisch übernommen.', 'error');
        return;
      }
      socket.send(JSON.stringify({ type: 'join', syncId: STANDALONE_ID, pin: STANDALONE_PIN }));
      log(INTEGRATED ? 'Mit der VFR-Multitool-Haupt-App verbunden.' : 'Die Verbindung zur VFR-Haupt-App ist bereit.', 'ok');
      setTimeout(() => {
        sendCommand('homebase_v1.capabilities');
        sendStabilizerCommand('homebase_v1.door_automation.set', { enabled: state.doorAutomationEnabled !== false, resetManualOverrides: false });
      }, 150);
    };
    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      if (data.type === 'error') { log(data.message || 'Die Verbindung ist fehlgeschlagen.', 'error'); return; }
      if (data.trackerCommand || data.commandOnly) return;
      if (data.homebaseHello) {
        trackerLastSeen = Date.now();
        const caps = Array.isArray(data.homebaseHello.capabilities) ? data.homebaseHello.capabilities : [];
        if (caps.includes('homebase-door-automation-v1')) {
          sendStabilizerCommand('homebase_v1.door_automation.set', { enabled: state.doorAutomationEnabled !== false, resetManualOverrides: false });
        }
        const helloSignature = `${data.homebaseHello.version || ''}|${Boolean(data.homebaseHello.simConnected)}|${caps.join(',')}`;
        setPill('trackerPill', `PC-Tracker ${data.homebaseHello.version || 'bereit'}`, 'ok');
        setPill('simPill', data.homebaseHello.simConnected ? 'MSFS verbunden' : 'MSFS noch nicht verbunden', data.homebaseHello.simConnected ? 'ok' : 'warn');
        if (helloSignature !== connect.lastHelloSignature) {
          connect.lastHelloSignature = helloSignature;
          log(`PC-Tracker erkannt: ${caps.join(', ')}`, 'ok');
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
          scheduleControlStateReapply();
        }
        setResult('previewResult', `Die Homebase wird im Simulator angezeigt. ${ack.extraCount || 0} Ausstattungsobjekte sind aktiv.${failed}`, livePreviewReady);
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
        if (ok && spawned?.id) {
          liveObjectIds.add(spawned.id);
          scheduleControlStateReapply();
        }
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
      if (data.stabilizerAck?.type === 'homebase_v1.preview.people.sync_ack') {
        const ack = data.stabilizerAck;
        const ok = ack.status === 'ok' || ack.status === 'noop';
        setResult('peopleResult', ack.message || (ok ? 'Personen und Wegpunkte wurden live aktualisiert.' : 'Personen konnten nicht aktualisiert werden.'), ok);
        log(`${ack.type}: ${ack.message || ack.status}`, ok ? 'ok' : 'error');
      }
      if (['homebase_v1.object.control.set_ack', 'homebase_v1.hangar.animation.set_ack'].includes(data.stabilizerAck?.type)) {
        handleControlAck(data.stabilizerAck);
      }
      if (data.stabilizerAck?.type === 'homebase_v1.door_automation.set_ack') {
        const ack = data.stabilizerAck;
        const ok = ack.status === 'ok';
        setResult('previewResult', ack.message || (ok ? 'Automatische Hangartorsteuerung aktualisiert.' : 'Automatische Hangartorsteuerung konnte nicht aktualisiert werden.'), ok);
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
            setResult('previewResult', `Der gelbe Messkegel steht am Startpunkt. Gemessene Bodenhöhe: ${state.spawn.altFt.toFixed(1)} ft.`, true);
            log(`Bodenhöhe am Startpunkt über den Messkegel gelesen: ${state.spawn.altFt.toFixed(2)} ft.`, 'ok');
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
        setResult('previewResult', ack.message || (ok ? 'Das Objekt wurde an die neue Position verschoben.' : 'Das Objekt konnte nicht verschoben werden.'), ok);
        log(`${ack.type}: ${ack.message || ack.status}`, ok ? 'ok' : 'error');
      }
      if (data.type === 'gps' && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lon))) {
        trackerLastSeen = Date.now();
        if (Number.isFinite(Number(data.groundAltitudeFt))) {
          lastGroundAltitude = { altFt: Number(data.groundAltitudeFt), receivedAt: Date.now() };
        }
        lastTelemetry = { lat: Number(data.lat), lon: Number(data.lon), altFt: finite(data.alt, 0), heading: normalizeHeading(data.hdg), flight: data.flight || {} };
        planeMarker.setLatLng([lastTelemetry.lat, lastTelemetry.lon]).setOpacity(1);
        if (routeDebugEnabled && aircraftMovedForRoutePlanner()) planRouteDebug();
        setPill('trackerPill', `PC-Tracker ${data.trackerVersion || 'online'}`, 'ok');
        setPill('simPill', 'MSFS verbunden', 'ok');
        if (!centeredOnce) {
          centeredOnce = true;
          map.setView([lastTelemetry.lat, lastTelemetry.lon], 18);
          setResult('previewResult', 'Die automatische Homebase wird aktiviert, sobald du dich innerhalb von 20 NM ihres Standorts befindest.');
        }
      }
    };
    socket.onerror = () => setPill('relayPill', 'Verbindung fehlgeschlagen', 'bad');
    socket.onclose = () => {
      invalidateLivePreview();
      setPill('relayPill', INTEGRATED ? 'Haupt-App getrennt' : 'Verbindung getrennt', 'warn');
      setPill('trackerPill', 'PC-Tracker nicht verbunden', 'muted');
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
      if (ok && !failed) scheduleControlStateReapply();
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
    } else if (['homebase_v1.object.control.set_ack', 'homebase_v1.hangar.animation.set_ack'].includes(ack.type)) {
      handleControlAck(ack);
    } else if (ack.type.startsWith('homebase_v1.package.')) {
      setResult('packageResult', `${message}${ack.path ? ` ${ack.path}` : ''}`, ok);
    } else if (ack.type === 'homebase_v1.door_automation.set_ack') {
      setResult('previewResult', message, ok);
    }
  }

  function setupMobileMapPin() {
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    const root = document.documentElement;
    const topbar = document.querySelector('.topbar');
    const mapPanel = document.querySelector('.map-panel');
    if (!topbar || !mapPanel) return;
    let scheduled = false;
    const sync = () => {
      scheduled = false;
      if (!mobileQuery.matches) {
        root.classList.remove('mobile-map-pinned');
        root.style.removeProperty('--mobile-map-height');
        return;
      }
      const mapHeight = Math.round(mapPanel.getBoundingClientRect().height);
      if (mapHeight > 0) root.style.setProperty('--mobile-map-height', `${mapHeight}px`);
      root.classList.toggle('mobile-map-pinned', window.scrollY >= topbar.offsetHeight);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(sync);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    mobileQuery.addEventListener?.('change', schedule);
    sync();
  }

  spawnMarker.on('dragend', () => {
    if (!confirmCompiledBaseMove()) return;
    const point = spawnMarker.getLatLng();
    state.spawn.lat = point.lat; state.spawn.lon = point.lng;
    saveState(); syncInputsFromState(); updateMap(); invalidateLivePreview();
  });
  hangarMarker.on('dragend', () => {
    if (!confirmCompiledChange('hangar', 'Der Hangar')) return;
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
  $('personModelSelect').addEventListener('change', readSelectedPersonFromInputs);
  ['personStartNorth', 'personStartEast', 'personSpeed'].forEach((id) => {
    $(id).addEventListener('input', readSelectedPersonFromInputs);
    $(id).addEventListener('change', readSelectedPersonFromInputs);
  });
  $('personRandomTargetsToggle').addEventListener('change', readSelectedPersonRandomTargets);
  ['personRandomWaitMin', 'personRandomWaitMax'].forEach((id) => {
    $(id).addEventListener('input', readSelectedPersonRandomTargets);
    $(id).addEventListener('change', readSelectedPersonRandomTargets);
  });
  document.querySelectorAll('[data-nudge]').forEach((button) => button.addEventListener('click', () => {
    if (!confirmCompiledChange('hangar', 'Der Hangar')) return;
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
    if (!confirmCompiledChange(item.id, item.label || 'Dieses Objekt')) return;
    const step = finite($('objectNudgeStep').value, .5);
    if (button.dataset.objectNudge === 'north') item.northM += step;
    if (button.dataset.objectNudge === 'south') item.northM -= step;
    if (button.dataset.objectNudge === 'east') item.eastM += step;
    if (button.dataset.objectNudge === 'west') item.eastM -= step;
    saveState(); syncInputsFromState(); updateMap(); scheduleLiveObjectMove(item);
  }));
  document.querySelectorAll('[data-object-rotate]').forEach((button) => button.addEventListener('click', () => {
    const item = selectedObject();
    if (!item) return;
    if (!confirmCompiledChange(item.id, item.label || 'Dieses Objekt')) return;
    item.heading = normalizeHeading(item.heading + finite(button.dataset.objectRotate));
    saveState(); syncInputsFromState(); updateMap(); scheduleLiveObjectMove(item);
  }));

  $('useAircraftBtn').addEventListener('click', () => {
    if (!lastTelemetry) { log('Noch keine MSFS-Telemetrie vorhanden.', 'error'); return; }
    if (!confirmCompiledBaseMove()) return;
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
    if (!confirmCompiledChange('hangar', 'Der Hangar')) return;
    state.hangar.northM = 0; state.hangar.eastM = 0;
    state.hangar.heading = state.spawn.heading;
    state.hangar.objectTitle = normalizeHangarTitle($('hangarSelect').value);
    saveState(); syncInputsFromState(); updateMap();
    log(`${$('hangarSelect').selectedOptions[0]?.textContent || 'Hangar'} wird am Startpunkt platziert.`);
    sendPreview();
  });
  $('hangarSelect').addEventListener('change', () => {
    if (!confirmCompiledChange('hangar', 'Der Hangar')) return;
    state.hangar.objectTitle = normalizeHangarTitle($('hangarSelect').value);
    if (state.hangar.objectTitle === OPEN_PARKING_TITLE) {
      state.people.forEach((person) => { person.stops = person.stops.filter((stop) => stop.targetType !== 'object' || stop.targetId !== 'hangar'); });
    }
    saveState(); syncInputsFromState(); updateMap();
    log(`${$('hangarSelect').selectedOptions[0]?.textContent || 'Vorschaumodell'} ausgewählt. Die Vorschau wird ersetzt.`);
    sendPreview();
  });
  $('addObjectBtn').addEventListener('click', () => addObject($('catalogSelect').value));
  $('duplicateObjectBtn').addEventListener('click', () => { const item = selectedObject(); if (item) addObject(item.title, item); });
  $('deleteObjectBtn').addEventListener('click', deleteSelectedObject);
  $('addPersonBtn').addEventListener('click', addPerson);
  $('addPersonStopBtn').addEventListener('click', addPersonDestination);
  $('deletePersonBtn').addEventListener('click', deleteSelectedPerson);
  $('crewShareToggle').addEventListener('change', () => {
    syncMeta.crewShareEnabled = $('crewShareToggle').checked === true;
    syncMeta.dirty = true;
    syncMeta.localUpdatedAt = Date.now();
    persistSyncMeta();
    postSyncDraft();
    setPill('syncPill', syncMeta.crewShareEnabled ? 'Crew-Freigabe wird gespeichert' : 'Crew-Freigabe wird aufgehoben', 'warn');
  });
  $('doorAutomationToggle').addEventListener('change', () => {
    state.doorAutomationEnabled = $('doorAutomationToggle').checked === true;
    saveState();
    const commandId = sendStabilizerCommand('homebase_v1.door_automation.set', { enabled: state.doorAutomationEnabled, resetManualOverrides: true });
    setResult('previewResult', commandId
      ? (state.doorAutomationEnabled ? 'Automatische Hangartorsteuerung wird aktiviert …' : 'Automatische Hangartorsteuerung wird deaktiviert …')
      : 'Die Einstellung wurde gespeichert; der Tracker ist momentan nicht erreichbar.', commandId ? null : false);
  });
  $('routeDebugToggle').addEventListener('change', () => {
    routeDebugEnabled = $('routeDebugToggle').checked === true;
    $('routeDebugPanel').hidden = !routeDebugEnabled;
    routeDebugLastAircraft = null;
    updateRouteDebugTargets();
    if (routeDebugEnabled) planRouteDebug();
    else { routeDebugResult = null; renderRouteDebug(); }
  });
  ['routeStartNorth', 'routeStartEast'].forEach((id) => $(id).addEventListener('change', planRouteDebug));
  $('routeTargetSelect').addEventListener('change', planRouteDebug);
  $('routeAircraftZoneToggle').addEventListener('change', () => { routeDebugLastAircraft = null; planRouteDebug(); });
  $('routePlanBtn').addEventListener('click', planRouteDebug);
  routeDebugStartMarker.on('dragend', () => {
    const point = routeDebugStartMarker.getLatLng();
    routeDebugStart = localOffsetMeters(state.spawn.lat, state.spawn.lon, point.lat, point.lng);
    $('routeStartNorth').value = Number(routeDebugStart.northM.toFixed(1));
    $('routeStartEast').value = Number(routeDebugStart.eastM.toFixed(1));
    planRouteDebug();
  });
  $('previewBtn').addEventListener('click', sendPreview);
  $('clearBtn').addEventListener('click', clearPreview);
  $('buildAirportBtn').addEventListener('click', buildAirportGuided);
  $('compileSpawnOnlyToggle').checked = localStorage.getItem(COMPILE_MODE_KEY) === 'spawn-only';
  $('compileSpawnOnlyToggle').addEventListener('change', () => {
    localStorage.setItem(COMPILE_MODE_KEY, selectedCompileMode());
    syncCompileModeUi();
  });
  $('assetPackageBtn').addEventListener('click', () => offerAssetPackageInstall({ force: true }));
  $('uninstallAirportBtn').addEventListener('click', uninstallAirport);
  $('clearLogBtn').addEventListener('click', () => { $('log').textContent = ''; });
  syncCompileModeUi();
  setupMobileMapPin();
  fillCatalog(); fillPersonCatalog(); hydrateAcknowledgedControlStatesFromPlan(); syncInputsFromState(); updateMap(); refreshLocalAssetInspection(); connect();
  if (INTEGRATED) {
    postSyncDraft();
    window.parent.postMessage({ channel: 'vfr-homebase', kind: 'workbench-ready' }, PARENT_ORIGIN);
  }
  log(INTEGRATED ? 'Homebase Workbench v1.0.0 in der VFR-Multitool-Haupt-App gestartet.' : 'Homebase Workbench v1.0.0 im Standalone-Modus gestartet.');
})();
