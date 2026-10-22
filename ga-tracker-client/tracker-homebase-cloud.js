'use strict';
// Der Tracker laedt die eigene Homebase selbst aus der Cloud und baut daraus
// mit dem gemeinsamen Szenen-Kern (homebase-scene-core.js) denselben Stand,
// den die App bisher per homebase_v1.fallback.store geschickt hat. Angewendet
// wird er ueber den bestehenden Fallback-Weg im Radius. Die App bleibt fuer
// das Bearbeiten zustaendig und uebernimmt nur bei ungespeicherten Entwuerfen.
//
// Status (oeffentlich, Telemetrie gpsMsg.homebase.cloudScene):
//   idle     noch kein Versuch
//   loading  Abruf laeuft
//   ok       Cloud-Stand ist im Tracker gespeichert und gilt
//   empty    keine Homebase in der Cloud (App mit rein lokaler Homebase bleibt zustaendig)
//   legacy   alter Datensatz ohne Personen in der Cloud (App bleibt zustaendig)
//   error    Abruf oder Aufbau fehlgeschlagen; vorhandener Zwischenspeicher bleibt
const sceneCoreApi = require('../homebase-scene-core.js');
const workbenchCatalog = require('../homebase/homebase-asset-catalog.js');
const { requestJson } = require('./tracker-navcom-preferences');

const CAPABILITY = 'homebase-cloud-scene-v1';
const DEFAULT_BASE_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase/';
const DEFAULT_REFRESH_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_MS = 60 * 1000;
const DEFAULT_INITIAL_WAIT_MS = 8000;

function createHomebaseCloudScene(options = {}) {
  const pilotId = String(options.pilotId || '').trim();
  const pin = String(options.pin || '').trim();
  const request = typeof options.request === 'function' ? options.request : requestJson;
  const baseUrl = String(options.baseUrl || DEFAULT_BASE_URL);
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const schedule = options.setTimeout || setTimeout;
  const cancel = options.clearTimeout || clearTimeout;
  const refreshMs = Number(options.refreshMs) > 0 ? Number(options.refreshMs) : DEFAULT_REFRESH_MS;
  const retryMs = Number(options.retryMs) > 0 ? Number(options.retryMs) : DEFAULT_RETRY_MS;
  const initialWaitMs = Number(options.initialWaitMs) >= 0 ? Number(options.initialWaitMs) : DEFAULT_INITIAL_WAIT_MS;
  const getPackageStatus = options.getPackageStatus;
  const getCurrentCache = typeof options.getCurrentCache === 'function' ? options.getCurrentCache : () => null;
  const storeCache = options.storeCache;
  const scene = sceneCoreApi.createHomebaseSceneCore({ catalog: options.catalog || workbenchCatalog });
  const available = Boolean(pilotId && pin && typeof getPackageStatus === 'function' && typeof storeCache === 'function');
  const createdAt = now();
  const state = { status: 'idle', code: '', revision: '', sceneSignature: '', updatedAt: 0, attemptedAt: 0, objects: 0, people: 0 };
  let inFlight = null;
  let timer = null;
  let settled = !available;
  let stopped = false;

  const publicState = () => ({ ...state });
  const plan = (delayMs) => {
    if (stopped || !available) return;
    if (timer) cancel(timer);
    timer = schedule(() => { timer = null; void refresh('timer'); }, delayMs);
    timer?.unref?.();
  };
  const finish = (status, code = '', extra = {}) => {
    Object.assign(state, extra, { status, code, updatedAt: now() });
    settled = true;
    plan(status === 'error' ? retryMs : refreshMs);
    return publicState();
  };

  async function load(reason) {
    state.status = 'loading';
    state.attemptedAt = now();
    let response;
    try {
      response = await request(baseUrl + encodeURIComponent(pilotId), {
        headers: { 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin }
      });
    } catch (error) {
      log(`HOMEBASE_CLOUD_ERROR reason=${reason} code=cloud_unavailable error=${error?.message || error}`);
      return finish('error', 'cloud_unavailable');
    }
    if (response.status === 404) {
      log(`HOMEBASE_CLOUD_EMPTY reason=${reason}`);
      return finish('empty', '', { revision: '', sceneSignature: '' });
    }
    if (response.status === 401 || response.status === 403) {
      log(`HOMEBASE_CLOUD_ERROR reason=${reason} code=cloud_unauthorized status=${response.status}`);
      return finish('error', 'cloud_unauthorized');
    }
    if (!response.ok) {
      log(`HOMEBASE_CLOUD_ERROR reason=${reason} code=cloud_status status=${response.status}`);
      return finish('error', 'cloud_status');
    }
    let data;
    try { data = await response.json(); } catch (_) { data = null; }
    const record = data?.record || null;
    if (!record?.plan) {
      log(`HOMEBASE_CLOUD_EMPTY reason=${reason} detail=no-plan`);
      return finish('empty', '', { revision: '', sceneSignature: '' });
    }
    const revision = String(record.revision || '').slice(0, 100);
    // Alte Datensaetze (Schema < 2) hatten Personen nur lokal in der App.
    if (Number(record.schemaVersion || 1) < 2) {
      log(`HOMEBASE_CLOUD_LEGACY reason=${reason} revision=${revision}`);
      return finish('legacy', 'legacy_record', { revision });
    }
    let packageStatus;
    try { packageStatus = getPackageStatus(); } catch (error) {
      log(`HOMEBASE_CLOUD_ERROR reason=${reason} code=package_status_failed error=${error?.message || error}`);
      return finish('error', 'package_status_failed', { revision });
    }
    const built = scene.sceneFromCloudRecord(record, packageStatus);
    if (!built.ok || !built.payload) {
      log(`HOMEBASE_CLOUD_ERROR reason=${reason} code=${built.reason || 'scene_invalid'} revision=${revision}`);
      return finish('error', built.reason || 'scene_invalid', { revision });
    }
    const current = getCurrentCache();
    const unchanged = current?.sceneSignature === built.payload.sceneSignature
      && Number(current?.base?.lat) === Number(built.payload.base.lat)
      && Number(current?.base?.lon) === Number(built.payload.base.lon)
      && JSON.stringify(current?.controlStates || []) === JSON.stringify(built.payload.controlStates || [])
      && (current?.doorAutomationEnabled !== false) === (built.payload.doorAutomationEnabled !== false);
    if (!unchanged) {
      const stored = storeCache(built.payload, { source: 'cloud', revision });
      if (!stored?.ok) {
        log(`HOMEBASE_CLOUD_ERROR reason=${reason} code=store_failed error=${stored?.error || ''}`);
        return finish('error', 'store_failed', { revision });
      }
      if (stored.skipped) {
        log(`HOMEBASE_CLOUD_DEFERRED reason=${reason} code=${stored.reason || 'skipped'} revision=${revision} signature=${built.payload.sceneSignature}`);
        return finish('ok', stored.reason || 'skipped', { revision, sceneSignature: built.payload.sceneSignature,
          objects: built.payload.objects.length, people: built.payload.people.length });
      }
    }
    log(`HOMEBASE_CLOUD_SCENE reason=${reason} revision=${revision} signature=${built.payload.sceneSignature} objects=${built.payload.objects.length} people=${built.payload.people.length} compiled=${built.delta?.stats?.compiled || 0} changed=${unchanged ? 0 : 1}`);
    return finish('ok', '', {
      revision,
      sceneSignature: built.payload.sceneSignature,
      objects: built.payload.objects.length,
      people: built.payload.people.length
    });
  }

  function refresh(reason = 'manual') {
    if (!available || stopped) return Promise.resolve(publicState());
    if (inFlight) return inFlight;
    inFlight = load(reason).catch((error) => {
      log(`HOMEBASE_CLOUD_ERROR reason=${reason} code=unexpected error=${error?.message || error}`);
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
    // Erst nach dem ersten Abruf (oder spaetestens nach initialWaitMs) den
    // Zwischenspeicher anwenden: sonst wird beim Start zweimal aufgebaut.
    initialSettled: () => settled || now() - createdAt >= initialWaitMs,
    // Die App uebernimmt nur, wenn der Tracker keinen gueltigen Cloud-Stand hat.
    ownsScene: () => available && ['idle', 'loading', 'ok'].includes(state.status)
  };
}

module.exports = { CAPABILITY, createHomebaseCloudScene };
