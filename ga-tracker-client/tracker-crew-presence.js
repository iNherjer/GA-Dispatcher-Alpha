'use strict';
// Crew presence from the tracker: while the tracker runs the pilot counts as online
// for the crew, and (if shared) the current flight goes to the crew board, also
// when the pilot flies with tracker and EFB only.
//
// Traffic: one status beat every 5 minutes, plus one on a flight event (start,
// phase change, landing, end) at most once a minute. Crew and sharing switches
// come from the cloud profile (field:groupName, field:crewShare), read every
// 10 minutes. Rules shared with web app and worker: crew-presence-core.js.
const core = require('../crew-presence-core.js');
const cloudSync = require('../cloud-sync-client');
const { requestJson } = require('./tracker-navcom-preferences');
const zlib = require('node:zlib');

const DEFAULT_PRESENCE_URL = 'https://ga-proxy.einherjer.workers.dev/api/crew-presence-v1/';
const DEFAULT_PROFILE_URL = 'https://ga-proxy.einherjer.workers.dev/api/sync-v2/';
const TICK_MS = 15000;
const PROFILE_REFRESH_MS = 10 * 60 * 1000;
const BACKOFF_MS = 10 * 60 * 1000;
const FREE_FLIGHT_END_STILL_MS = 60 * 1000;
const STALE_SAMPLE_MS = 2 * 60 * 1000;
const MAX_MISSION_BYTES = 60 * 1024;        // compressed request body
const MAX_MISSION_RAW_BYTES = 2 * 1024 * 1024;
const PHASE_HOLD_MS = 30 * 1000;              // a new phase must hold this long (VS jitter in manual flight)
const FREE_ROUTE_MAX_OFF_NM = 15;             // a saved Direct To route farther away than this is not this flight's route

const normalizeGroupName = value => String(value || '').trim().toUpperCase().slice(0, 80);

function createCrewPresence(options = {}) {
  const pilotId = String(options.pilotId || '').trim();
  const pin = String(options.pin || '').trim();
  const request = typeof options.request === 'function' ? options.request : requestJson;
  const presenceUrl = String(options.presenceUrl || DEFAULT_PRESENCE_URL);
  const profileUrl = String(options.profileUrl || DEFAULT_PROFILE_URL);
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const getRoute = typeof options.getRoute === 'function' ? options.getRoute : () => null;
  const schedule = options.setInterval || setInterval;
  const cancel = options.clearInterval || clearInterval;
  const available = Boolean(pilotId && pin);
  const profileClient = available && typeof options.readProfile !== 'function'
    ? cloudSync.create({ pilotId, pin, request, baseUrl: profileUrl })
    : null;

  let groupName = '';
  let share = core.normalizeShare(null);
  let profileReadAt = -Infinity;
  let profileReading = null;
  let blockedUntil = 0;
  let sample = null;
  let sampleAt = 0;
  let current = null;      // flight being reported { kind, id, takeoffAt, landedAt, endedAt, leg, progress, ... }
  let airborne = { takeoffAt: 0, landedAt: 0, stillSince: 0 };
  let lastBeat = null;
  let offlineSent = false;
  let sending = null;
  let timer = null;
  let stopped = false;

  async function readProfile() {
    if (typeof options.readProfile === 'function') return options.readProfile();
    const result = await profileClient.read(['field:groupName', 'field:crewShare']);
    if (result.migrated) return result.profile || {};
    const response = await request(profileUrl.replace(/\/sync-v2\/?$/, '/sync/') + encodeURIComponent(pilotId), { headers: { 'X-Pilot-PIN': pin } });
    if (!response.ok) throw new Error(`profile_status_${response.status}`);
    return response.json();
  }

  function refreshProfile(force = false) {
    if (profileReading || (!force && now() - profileReadAt < PROFILE_REFRESH_MS)) return profileReading;
    profileReading = readProfile().then(profile => {
      const nextGroup = normalizeGroupName(profile?.groupName);
      if (nextGroup !== groupName) {
        log(`CREW_PRESENCE_GROUP group=${nextGroup || '-'}`);
        groupName = nextGroup;
        lastBeat = null;
        offlineSent = false;
      }
      const nextShare = core.normalizeShare(profile?.crewShare);
      if (nextShare.at >= share.at) share = nextShare;
      profileReadAt = now();
    }).catch(error => {
      profileReadAt = now() - PROFILE_REFRESH_MS + 60000; // retry in a minute
      log(`CREW_PRESENCE_ERROR code=profile_unavailable error=${error?.message || error}`);
    }).finally(() => { profileReading = null; });
    return profileReading;
  }

  // Called with every telemetry sample; only updates local state.
  function observe(flight) {
    if (!flight || typeof flight !== 'object') return;
    const t = now();
    sample = { lat: Number(flight.lat), lon: Number(flight.lon), altFt: Number(flight.altFt), hdg: Number(flight.hdg), onGround: !!flight.onGround, gsKts: Number(flight.gsKts ?? flight.gs) || 0, vsFpm: Number(flight.vsFpm) || 0 };
    sampleAt = t;
    if (!sample.onGround) {
      // A touch-and-go keeps the flight; a new flight starts only after the last one ended.
      airborne = { takeoffAt: airborne.takeoffAt || t, landedAt: 0, stillSince: 0 };
      return;
    }
    if (airborne.takeoffAt && !airborne.landedAt) airborne.landedAt = t;
    if (airborne.landedAt) airborne.stillSince = sample.gsKts < 3 ? (airborne.stillSince || t) : 0;
  }

  const resetAirborne = () => { airborne = { takeoffAt: 0, landedAt: 0, stillSince: 0 }; };

  // Start or update the flight that belongs to the current mission run or free flight.
  function routeFlight(route, t, missionId) {
    const live = sample && t - sampleAt <= STALE_SAMPLE_MS ? sample : null;
    if (missionId) {
      if (!current || current.id !== missionId) {
        current = { kind: 'mission', id: missionId, startedAt: Number(route.startedAt) || t, leg: 0, progress: null, takeoffAt: 0, landedAt: 0, endedAt: 0 };
        if (live?.onGround) resetAirborne();
      }
      if (airborne.takeoffAt && !current.takeoffAt) current.takeoffAt = airborne.takeoffAt;
    } else {
      // Free flight: from takeoff until standing still after the landing.
      if (!airborne.takeoffAt) return null;
      const id = `free-${airborne.takeoffAt}`;
      if (!current || current.id !== id) {
        current = { kind: 'free', id, startedAt: airborne.takeoffAt, leg: 0, progress: null, takeoffAt: airborne.takeoffAt, landedAt: 0, endedAt: 0 };
      }
    }
    // Free flights only use the saved navigation route while the aircraft is near it; the
    // tracker keeps the last Direct To route across sessions.
    let usable = route;
    if (!missionId && live && Array.isArray(route?.waypoints) && route.waypoints.length >= 2) {
      const check = core.routeProgress(route.waypoints, live, current.leg);
      if (!check || check.offNm > FREE_ROUTE_MAX_OFF_NM) usable = { title: '' };
    }
    Object.assign(current, {
      title: usable?.title || '', dep: usable?.dep || '', depName: usable?.depName || '',
      dest: usable?.dest || '', destName: usable?.destName || '',
      route: Array.isArray(usable?.waypoints) ? usable.waypoints : [],
      missionState: missionId ? route?.missionState || null : null
    });
    current.landedAt = current.takeoffAt ? airborne.landedAt : 0;
    if (live) {
      const progress = core.routeProgress(usable?.waypoints, live, current.leg);
      if (progress) {
        current.leg = Math.max(current.leg, progress.leg);
        current.progress = Math.max(current.progress ?? 0, progress.progress);
      }
      const candidate = core.flightPhase(live, !!current.takeoffAt);
      if (!current.phase || candidate === current.phase || candidate === 'landed') {
        current.phase = candidate;
        current.phaseCandidate = null;
      } else if (current.phaseCandidate?.phase !== candidate) {
        current.phaseCandidate = { phase: candidate, since: t };
      } else if (t - current.phaseCandidate.since >= PHASE_HOLD_MS) {
        current.phase = candidate;
        current.phaseCandidate = null;
      }
      current.pos = { lat: live.lat, lon: live.lon, altFt: live.altFt, hdg: live.hdg, gsKts: live.gsKts, at: sampleAt };
    }
    if (!missionId && current.landedAt && airborne.stillSince && t - airborne.stillSince >= FREE_FLIGHT_END_STILL_MS) {
      current.endedAt = t;
      resetAirborne();
    }
    return current;
  }

  function buildFlight(t) {
    let route = null;
    try { route = getRoute(); } catch (error) { log(`CREW_PRESENCE_ERROR code=route error=${error?.message || error}`); }
    const missionId = route?.kind === 'mission' ? String(route.id || '') : '';
    if (current?.kind === 'mission' && !current.endedAt && current.id !== missionId) {
      // Run finished or aborted: a flown run shows as landed, an unflown one disappears.
      if (current.takeoffAt) Object.assign(current, { endedAt: t, progress: 1 });
      else current = null;
      if (sample?.onGround) resetAirborne();
    }
    if (current?.endedAt) {
      const replaced = !!missionId || airborne.takeoffAt > 0;
      if (!replaced && t - current.endedAt <= core.LANDED_VISIBLE_MS) return core.cleanFlight({ ...current, phase: 'landed' });
      current = null;
    }
    const flight = routeFlight(route, t, missionId);
    return flight ? core.cleanFlight({ ...flight, phase: flight.endedAt ? 'landed' : flight.phase }) : null;
  }

  async function post(body) {
    const response = await request(presenceUrl + encodeURIComponent(groupName), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin },
      body: JSON.stringify(body)
    });
    if (response.status === 401 || response.status === 403) {
      blockedUntil = now() + BACKOFF_MS;
      profileReadAt = -Infinity; // crew may have changed
      log(`CREW_PRESENCE_ERROR code=${response.status === 403 ? 'not_member' : 'unauthorized'} group=${groupName}`);
      return false;
    }
    if (!response.ok) {
      log(`CREW_PRESENCE_ERROR code=status status=${response.status}`);
      return false;
    }
    return true;
  }

  // Once per mission flight: the planned mission, so crew members can fly it themselves.
  let missionUploaded = '';
  async function uploadMission(flight) {
    if (flight?.kind !== 'mission' || flight.endedAt || missionUploaded === flight.id || !current?.missionState) return;
    const json = JSON.stringify(core.sharedMissionState(current.missionState));
    const data = json.length <= MAX_MISSION_RAW_BYTES ? zlib.gzipSync(json).toString('base64') : '';
    const body = JSON.stringify({ flightId: flight.id, encoding: 'gzip-base64', data });
    if (!data || body.length > MAX_MISSION_BYTES) {
      missionUploaded = flight.id;
      log(`CREW_PRESENCE_MISSION_SKIPPED id=${flight.id} raw=${json.length} bytes=${body.length}`);
      return;
    }
    const response = await request(presenceUrl + encodeURIComponent(groupName) + '/mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin },
      body
    });
    if (response.ok) {
      missionUploaded = flight.id;
      log(`CREW_PRESENCE_MISSION id=${flight.id} raw=${json.length} bytes=${body.length}`);
    }
  }

  async function tick() {
    if (!available || stopped || sending) return;
    const t = now();
    if (t < blockedUntil) return;
    await refreshProfile(false);
    if (!groupName) return;
    const flight = buildFlight(t);
    sending = (async () => {
      try {
        if (!share.online && !share.flight) {
          if (!offlineSent && await post({ offline: true })) offlineSent = true;
          lastBeat = null;
          return;
        }
        offlineSent = false;
        if (share.flight) await uploadMission(flight);
        if (!core.shouldBeat(lastBeat, flight, t)) return;
        if (await post({ source: 'tracker', share, flight })) {
          if (core.flightEvent(lastBeat?.flight || null, flight)) {
            log(`CREW_PRESENCE_FLIGHT id=${flight?.id || '-'} phase=${flight?.phase || '-'} progress=${flight?.progress ?? '-'} ended=${flight?.endedAt ? 1 : 0}`);
          }
          lastBeat = { at: t, flight };
        }
      } catch (error) {
        log(`CREW_PRESENCE_ERROR code=cloud_unavailable error=${error?.message || error}`);
      }
    })().finally(() => { sending = null; });
    return sending;
  }

  return {
    available,
    observe,
    tick,
    // App told us about a crew change (join/leave) before the profile sync ran.
    setGroup(name) {
      const next = normalizeGroupName(name);
      if (next === groupName) return;
      groupName = next;
      lastBeat = null;
      offlineSent = false;
      blockedUntil = 0;
      profileReadAt = now();
    },
    start() {
      if (!available || timer || stopped) return;
      timer = schedule(() => { void tick(); }, TICK_MS);
      timer?.unref?.();
      setTimeout(() => { void tick(); }, 5000).unref?.();
    },
    // Best effort on shutdown: the crew sees the pilot offline at once.
    async stop() {
      stopped = true;
      if (timer) cancel(timer);
      timer = null;
      if (!available || !groupName || !lastBeat) return;
      try { await post({ offline: true }); } catch (_) {}
    },
    publicState: () => ({ groupName, share: { ...share }, lastBeatAt: lastBeat?.at || 0, flight: lastBeat?.flight || null })
  };
}

module.exports = { createCrewPresence };
