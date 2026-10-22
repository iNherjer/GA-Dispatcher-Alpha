'use strict';
// Crew-Homebases ohne App: Der Tracker liest den Gruppennamen aus dem
// Cloud-Profil (field:groupName), ruft /api/homebase-group/<Gruppe> ab und baut
// mit dem gemeinsamen Szenen-Kern dieselbe Crew-Szene wie bisher die App
// (10-NM-Radius, hoechstens 100 Objekte). Die eigene Basis liefert der Server
// nicht mit.
//
// Status (oeffentlich, Telemetrie gpsMsg.homebase.crewScene):
//   idle      noch kein Abruf
//   loading   Abruf laeuft
//   ok        Crew-Bases der Gruppe sind bekannt, Tracker baut die Crew-Szene
//   no-group  im Profil ist keine Gruppe hinterlegt
//   error     Abruf fehlgeschlagen (letzte bekannte Bases bleiben bis zum Erfolg)
const cloudSync = require('../cloud-sync-client');
const sceneCoreApi = require('../homebase-scene-core.js');
const workbenchCatalog = require('../homebase/homebase-asset-catalog.js');
const { requestJson } = require('./tracker-navcom-preferences');

const CAPABILITY = 'homebase-crew-cloud-v1';
const DEFAULT_CREW_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase-group/';
const DEFAULT_PROFILE_URL = 'https://ga-proxy.einherjer.workers.dev/api/sync-v2/';
const DEFAULT_POLL_MS = 45000;
const DEFAULT_GROUP_REFRESH_MS = 10 * 60 * 1000;
const DEFAULT_RETRY_MS = 60000;

const normalizeGroupName = (value) => String(value || '').trim().toUpperCase().slice(0, 80);

function createHomebaseCrewScene(options = {}) {
  const pilotId = String(options.pilotId || '').trim();
  const pin = String(options.pin || '').trim();
  const request = typeof options.request === 'function' ? options.request : requestJson;
  const crewUrl = String(options.crewUrl || DEFAULT_CREW_URL);
  const profileUrl = String(options.profileUrl || DEFAULT_PROFILE_URL);
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const schedule = options.setTimeout || setTimeout;
  const cancel = options.clearTimeout || clearTimeout;
  const pollMs = Number(options.pollMs) > 0 ? Number(options.pollMs) : DEFAULT_POLL_MS;
  const groupRefreshMs = Number(options.groupRefreshMs) > 0 ? Number(options.groupRefreshMs) : DEFAULT_GROUP_REFRESH_MS;
  const retryMs = Number(options.retryMs) > 0 ? Number(options.retryMs) : DEFAULT_RETRY_MS;
  const scene = sceneCoreApi.createHomebaseSceneCore({ catalog: options.catalog || workbenchCatalog });
  const available = Boolean(pilotId && pin);
  const profileClient = available && typeof options.readGroupName !== 'function'
    ? cloudSync.create({ pilotId, pin, request, baseUrl: profileUrl })
    : null;
  const state = { status: 'idle', code: '', groupName: '', bases: 0, updatedAt: 0 };
  let bases = [];
  let groupReadAt = -Infinity;
  let inFlight = null;
  let timer = null;
  let stopped = false;

  async function readGroupNameFromProfile() {
    if (typeof options.readGroupName === 'function') return normalizeGroupName(await options.readGroupName());
    const result = await profileClient.read(['field:groupName']);
    let profile = result.migrated ? result.profile : null;
    if (!result.migrated) {
      const response = await request(profileUrl.replace(/\/sync-v2\/?$/, '/sync/') + encodeURIComponent(pilotId), { headers: { 'X-Pilot-PIN': pin } });
      if (!response.ok) throw new Error(`profile_status_${response.status}`);
      profile = await response.json();
    }
    return normalizeGroupName(profile?.groupName);
  }

  const publicState = () => ({ ...state });
  const plan = (delayMs) => {
    if (stopped || !available) return;
    if (timer) cancel(timer);
    timer = schedule(() => { timer = null; void refresh('poll'); }, delayMs);
    timer?.unref?.();
  };
  const finish = (status, code = '') => {
    Object.assign(state, { status, code, bases: bases.length, updatedAt: now() });
    plan(status === 'error' ? retryMs : pollMs);
    return publicState();
  };

  async function load(reason, forceGroup, hintedGroup) {
    // Nur der erste Abruf zeigt "loading"; spaetere Abrufe behalten den letzten
    // Status, damit die App nicht bei jedem Abruf kurz uebernimmt.
    if (state.status === 'idle') state.status = 'loading';
    if (hintedGroup !== undefined) {
      // Gruppenwechsel in der App: der Profil-Sync kann noch ausstehen. Der
      // Server prueft die Mitgliedschaft selbst (403 -> leeren).
      const groupName = normalizeGroupName(hintedGroup);
      if (groupName !== state.groupName) log(`HOMEBASE_CREW_GROUP reason=${reason} group=${groupName || '-'} source=app`);
      state.groupName = groupName;
      groupReadAt = now();
    } else if (forceGroup || now() - groupReadAt >= groupRefreshMs) {
      try {
        const groupName = await readGroupNameFromProfile();
        if (groupName !== state.groupName) log(`HOMEBASE_CREW_GROUP reason=${reason} group=${groupName || '-'}`);
        state.groupName = groupName;
        groupReadAt = now();
      } catch (error) {
        log(`HOMEBASE_CREW_ERROR reason=${reason} code=profile_unavailable error=${error?.message || error}`);
        if (!state.groupName) return finish('error', 'profile_unavailable');
      }
    }
    if (!state.groupName) {
      if (bases.length) log(`HOMEBASE_CREW_CLEARED reason=${reason} cause=no-group`);
      bases = [];
      return finish('no-group');
    }
    let response;
    try {
      response = await request(crewUrl + encodeURIComponent(state.groupName), {
        headers: { 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin }
      });
    } catch (error) {
      log(`HOMEBASE_CREW_ERROR reason=${reason} code=cloud_unavailable error=${error?.message || error}`);
      return finish('error', 'cloud_unavailable');
    }
    if (response.status === 403) {
      // Nicht (mehr) Mitglied: Crew-Szene leeren und den Gruppennamen neu lesen.
      log(`HOMEBASE_CREW_ERROR reason=${reason} code=not_member group=${state.groupName}`);
      bases = [];
      groupReadAt = -Infinity;
      return finish('error', 'not_member');
    }
    if (response.status === 401) {
      log(`HOMEBASE_CREW_ERROR reason=${reason} code=cloud_unauthorized`);
      return finish('error', 'cloud_unauthorized');
    }
    if (!response.ok) {
      log(`HOMEBASE_CREW_ERROR reason=${reason} code=cloud_status status=${response.status}`);
      return finish('error', 'cloud_status');
    }
    let data;
    try { data = await response.json(); } catch (_) { data = null; }
    const next = Array.isArray(data?.bases) ? data.bases : null;
    if (!next) {
      log(`HOMEBASE_CREW_ERROR reason=${reason} code=response_invalid`);
      return finish('error', 'response_invalid');
    }
    if (next.length !== bases.length || JSON.stringify(next) !== JSON.stringify(bases)) {
      log(`HOMEBASE_CREW_BASES reason=${reason} group=${state.groupName} bases=${next.length}`);
    }
    bases = next;
    return finish('ok');
  }

  function refresh(reason = 'manual', { forceGroup = false, groupName } = {}) {
    if (!available || stopped) return Promise.resolve(publicState());
    if (inFlight) {
      // Ein Gruppenwechsel darf nicht im laufenden Abruf verloren gehen.
      if (groupName === undefined) return inFlight;
      return inFlight.then(() => refresh(reason, { forceGroup, groupName }));
    }
    inFlight = load(reason, forceGroup, groupName).catch((error) => {
      log(`HOMEBASE_CREW_ERROR reason=${reason} code=unexpected error=${error?.message || error}`);
      return finish('error', 'unexpected');
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  return {
    capability: CAPABILITY,
    available,
    refresh,
    start(delayMs = 0) { plan(Math.max(0, Number(delayMs) || 0)); },
    stop() { stopped = true; if (timer) cancel(timer); timer = null; },
    publicState,
    // null: der Tracker ist (noch) nicht zustaendig und laesst die Crew-Szene in
    // Ruhe. [] leert sie (keine Gruppe / nicht mehr Mitglied).
    sceneFor(position) {
      if (!available) return null;
      if (state.status === 'no-group' || (state.status === 'error' && state.code === 'not_member')) return [];
      if (state.status !== 'ok') return null;
      return scene.crewSceneForPosition(bases, position);
    }
  };
}

module.exports = { CAPABILITY, createHomebaseCrewScene, normalizeGroupName };
