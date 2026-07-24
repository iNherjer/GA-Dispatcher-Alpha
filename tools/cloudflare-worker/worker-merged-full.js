const OPENAIP_KEY = "049026a617e1380ac056e1fd3cc237ae";
const DEFAULT_OBS_TILE_BASE = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/obstacles/tiles";
const DEFAULT_OBS_CORE_TILE_BASE = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/obstacles/core-tiles";
const DEFAULT_OBS_POI_TILE_BASE = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/obstacles/poi-tiles";
const DEFAULT_OBS_INFRA_TILE_BASE = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/obstacles/infra-tiles";
const TRACKER_STABLE_CHANNEL_URL = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/ga-tracker-client/channel/stable.json";
const TRACKER_RELEASE_ASSET_NAME = "VFR-Multitool-Tracker.exe";

const AIP_POPUP_ROUTES = {
  AT: "/at/en/vfr/",
  DE: "/de/en/vfr/",
  FR: "/fr/aeroports/",
  GB: "/uk/vfr/",
  NL: "/nl/en/vfr/"
};

const FILE_ALLOWED_HOSTS = new Set([
  "aip.aero",
  "aip.dfs.de",
  "secais.dfs.de",
  "dfs.de",
  "www.dfs.de"
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "X-Pilot-ID"
};

const MOSMIX_STATION_CATALOG_URL = "https://www.dwd.de/EN/ourservices/met_application_mosmix/mosmix_stations.cfg?view=nasPublication&nn=495490";
const MOSMIX_SINGLE_BASE = "https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations";
const MOSMIX_MAX_POINTS = 90;
const MOSMIX_MAX_STATIONS = 80;
const MOSMIX_MAX_TARGETS = 6;
const MOSMIX_NEAREST_MAX_KM = 95;
const MOSMIX_ELEMENTS = ["VV", "N05", "Nl", "Nm", "Nh", "N", "RR1c", "WPc11"];
let mosmixStationCatalogCache = null;
let mosmixStationCatalogAt = 0;
let mosmixStationDataCache = new Map();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

function normalizeTrackerChannel(raw) {
  const channel = raw && typeof raw === "object" ? raw : null;
  const version = String(channel?.version || "").trim();
  const releaseTag = String(channel?.releaseTag || "").trim();
  const versionCode = Number(channel?.versionCode);
  const assetName = String(channel?.asset?.name || "").trim();
  const assetUrl = String(channel?.asset?.url || "").trim();
  const size = Number(channel?.asset?.size);
  const sha256 = String(channel?.asset?.sha256 || "").trim().toLowerCase();
  if (channel?.schemaVersion !== 1 || !/^v[1-9][0-9]*$/.test(version) || releaseTag !== version) return null;
  if (!Number.isInteger(versionCode) || versionCode !== Number(version.slice(1))) return null;
  if (assetName !== TRACKER_RELEASE_ASSET_NAME || !Number.isInteger(size) || size <= 0 || !/^[a-f0-9]{64}$/.test(sha256)) return null;
  let parsed;
  try { parsed = new URL(assetUrl); } catch { return null; }
  const expectedPath = `/iNherjer/GA-Dispatcher-Alpha/releases/download/${releaseTag}/${TRACKER_RELEASE_ASSET_NAME}`;
  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com" || parsed.pathname !== expectedPath || parsed.search || parsed.hash) return null;
  return { schemaVersion: 1, publishedAt: String(channel.publishedAt || ""), version, versionCode, releaseTag, asset: { name: assetName, url: assetUrl, size, sha256 } };
}

async function handleTrackerDownload(requestUrl) {
  let upstream;
  try {
    const channelUrl = new URL(TRACKER_STABLE_CHANNEL_URL);
    channelUrl.searchParams.set("_vfrcb", String(Date.now()));
    upstream = await fetch(channelUrl.toString(), { headers: { Accept: "application/json", "Cache-Control": "no-cache" } });
  } catch (error) {
    return json({ ok: false, error: "Tracker-Kanal ist derzeit nicht erreichbar.", detail: String(error?.message || error) }, 502, { "Cache-Control": "no-store" });
  }
  if (!upstream.ok) return json({ ok: false, error: "Tracker-Kanal antwortete nicht erfolgreich.", status: upstream.status }, 502, { "Cache-Control": "no-store" });
  let raw;
  try { raw = await upstream.json(); } catch { return json({ ok: false, error: "Tracker-Kanal enthält kein gültiges JSON." }, 502, { "Cache-Control": "no-store" }); }
  const channel = normalizeTrackerChannel(raw);
  if (!channel) return json({ ok: false, error: "Tracker-Kanal ist ungültig." }, 502, { "Cache-Control": "no-store" });
  if (requestUrl.searchParams.get("format") === "json") return json({ ok: true, ...channel }, 200, { "Cache-Control": "public, max-age=60" });
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: channel.asset.url, "Cache-Control": "no-store", "X-Tracker-Version": channel.version }
  });
}

function hasSyncKvBinding(env) {
  return !!(env && env.GA_SYNC_KV && typeof env.GA_SYNC_KV.get === "function" && typeof env.GA_SYNC_KV.put === "function");
}

const BUG_REPORT_PREFIX = "bug:report:";
const BUG_OPEN_PREFIX = "bug:open:";
const BUG_REPORT_TTL = 180 * 24 * 60 * 60; // 180 Tage
const BUG_MAX_BODY_BYTES = 350 * 1024;
const ADMIN_KV_LIST_MAX = 5000;

const COMMUNITY_CHECKLIST_PREFIX = "checklist:community:";
const COMMUNITY_CHECKLIST_INDEX_PREFIX = "checklist:community:index:";
const COMMUNITY_CHECKLIST_AGGREGATE_INDEX_KEY = "checklist:community:index:v2";
const COMMUNITY_CHECKLIST_MAX_BODY_BYTES = 160 * 1024;
const COMMUNITY_CHECKLIST_MAX_CHAPTERS = 20;
const COMMUNITY_CHECKLIST_MAX_ITEMS = 300;

const HOMEBASE_PREFIX = "homebase:";
const HOMEBASE_MAX_BODY_BYTES = 64 * 1024;
const HOMEBASE_MAX_OBJECTS = 100;
const HOMEBASE_MAX_PEOPLE = 3;
const HOMEBASE_MAX_PERSON_DESTINATIONS = 20;
const HOMEBASE_CREW_OBJECTS_PER_BASE = 20;
const HOMEBASE_TTL = 31536000;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseDateMs(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 10000000000 ? value * 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value.trim());
    if (Number.isFinite(parsed)) return parsed;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric < 10000000000 ? numeric * 1000 : numeric;
  }
  return null;
}

function normalizeFinite(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeHeading(value) {
  const number = Math.round(normalizeFinite(value, 0, -100000, 100000));
  return ((number % 360) + 360) % 360;
}

function normalizeHomebaseObject(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = normalizeOneLine(source.id || `object-${index + 1}`, 64).replace(/[^a-zA-Z0-9_-]/g, "");
  const title = normalizeOneLine(source.title, 160);
  if (!id || !title) return null;
  return {
    id,
    title,
    label: normalizeOneLine(source.label || title, 160),
    northM: normalizeFinite(source.northM, 0, -2000, 2000),
    eastM: normalizeFinite(source.eastM, 0, -2000, 2000),
    heading: normalizeHeading(source.heading),
    heightFt: normalizeFinite(source.heightFt, 0, -20, 200),
    scale: normalizeFinite(source.scale, 1, 0.1, 10)
  };
}

function normalizeHomebasePersonDestination(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  const targetType = source.targetType === "waypoint" ? "waypoint" : "object";
  return {
    id: normalizeOneLine(source.id || `destination-${index + 1}`, 64).replace(/[^a-zA-Z0-9_-]/g, ""),
    targetType,
    targetId: targetType === "object" ? normalizeOneLine(source.targetId, 64).replace(/[^a-zA-Z0-9_-]/g, "") : "",
    northM: normalizeFinite(source.northM, 0, -2000, 2000),
    eastM: normalizeFinite(source.eastM, 0, -2000, 2000),
    waitMinS: normalizeFinite(source.waitMinS, 0, 0, 3600),
    waitMaxS: normalizeFinite(source.waitMaxS, normalizeFinite(source.waitMinS, 0, 0, 3600), 0, 3600)
  };
}

function normalizeHomebasePerson(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  const title = normalizeOneLine(source.title, 160);
  if (!/^Tarmac_[A-Za-z0-9_]+$/.test(title)) return null;
  return {
    id: normalizeOneLine(source.id || `person-${index + 1}`, 64).replace(/[^a-zA-Z0-9_-]/g, ""),
    title,
    label: normalizeOneLine(source.label || `Mitarbeiter ${index + 1}`, 80),
    startNorthM: normalizeFinite(source.startNorthM, 0, -2000, 2000),
    startEastM: normalizeFinite(source.startEastM, 0, -2000, 2000),
    speedKts: normalizeFinite(source.speedKts, 2.6, 1, 5),
    randomTargets: source.randomTargets === true,
    randomWaitMinS: normalizeFinite(source.randomWaitMinS, 5, 0, 3600),
    randomWaitMaxS: normalizeFinite(source.randomWaitMaxS, 30, 0, 3600),
    stops: (Array.isArray(source.stops) ? source.stops : []).slice(0, HOMEBASE_MAX_PERSON_DESTINATIONS).map(normalizeHomebasePersonDestination)
  };
}

function normalizeHomebasePlan(raw) {
  if (!raw || typeof raw !== "object") throw new Error("missing_plan");
  const spawn = raw.spawn && typeof raw.spawn === "object" ? raw.spawn : {};
  const hangar = raw.hangar && typeof raw.hangar === "object" ? raw.hangar : {};
  const objects = (Array.isArray(raw.objects) ? raw.objects : [])
    .slice(0, HOMEBASE_MAX_OBJECTS)
    .map(normalizeHomebaseObject)
    .filter(Boolean);
  const people = (Array.isArray(raw.people) ? raw.people : [])
    .slice(0, HOMEBASE_MAX_PEOPLE)
    .map(normalizeHomebasePerson)
    .filter(Boolean);
  return {
    doorAutomationEnabled: raw.doorAutomationEnabled !== false,
    spawn: {
      lat: normalizeFinite(spawn.lat, 48.1504, -90, 90),
      lon: normalizeFinite(spawn.lon, 7.7099, -180, 180),
      altFt: normalizeFinite(spawn.altFt, 0, -2000, 60000),
      heading: normalizeHeading(spawn.heading),
      mode: "airport_parking"
    },
    hangar: {
      northM: normalizeFinite(hangar.northM, 0, -2000, 2000),
      eastM: normalizeFinite(hangar.eastM, 0, -2000, 2000),
      heading: normalizeHeading(hangar.heading),
      heightFt: normalizeFinite(hangar.heightFt, 0, -50, 200),
      widthM: normalizeFinite(hangar.widthM, 18, 4, 80),
      depthM: normalizeFinite(hangar.depthM, 22, 4, 100),
      objectTitle: normalizeOneLine(hangar.objectTitle, 160)
    },
    objects,
    people
  };
}

async function handleHomebaseSync(request, requestUrl, env) {
  if (!hasSyncKvBinding(env)) {
    return json({ error: "Sync KV binding missing (GA_SYNC_KV)." }, 503);
  }
  const pilotId = decodeURIComponent(requestUrl.pathname.split("/").filter(Boolean)[2] || "");
  if (!pilotId || pilotId.length > 160 || pilotId.startsWith("GROUP_")) {
    return json({ error: "Ungültige Pilot-ID" }, 400);
  }
  const auth = await verifySyncProfileAuth(request, env);
  if (!auth.ok) return auth.response;
  if (normalizePilotIdLookup(auth.ownerId) !== normalizePilotIdLookup(pilotId)) return json({ error: "Pilot-ID stimmt nicht überein" }, 403);

  const key = `${HOMEBASE_PREFIX}${auth.ownerId}`;
  let existing = null;
  try {
    const raw = await env.GA_SYNC_KV.get(key);
    existing = raw ? safeJsonParse(raw, null) : null;
  } catch (error) {
    return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
  }

  if (request.method === "GET") {
    return existing ? json({ ok: true, record: existing }) : json({ error: "Keine Homebase gespeichert" }, 404);
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const rawBody = await request.text();
  if (rawBody.length > HOMEBASE_MAX_BODY_BYTES) return json({ error: "Homebase ist zu groß" }, 413);
  const incoming = safeJsonParse(rawBody, null);
  if (!incoming || typeof incoming !== "object") return json({ error: "Ungültiges JSON" }, 400);

  const baseRevision = normalizeOneLine(incoming.baseRevision, 100);
  const currentRevision = normalizeOneLine(existing?.revision, 100);
  if (existing && baseRevision !== currentRevision) {
    return json({ error: "Versionskonflikt", conflict: true, record: existing }, 409);
  }

  let plan;
  try {
    plan = normalizeHomebasePlan(incoming.plan);
  } catch {
    return json({ error: "Homebase-Plan fehlt oder ist ungültig" }, 400);
  }
  const updatedAt = Date.now();
  const record = {
    schemaVersion: 2,
    revision: `${updatedAt}-${crypto.randomUUID().slice(0, 8)}`,
    updatedAt,
    clientUpdatedAt: normalizeFinite(incoming.clientUpdatedAt, updatedAt, 1, updatedAt + 86400000),
    deviceId: normalizeOneLine(incoming.deviceId, 100),
    crewShareEnabled: incoming.crewShareEnabled === true,
    plan
  };
  try {
    await env.GA_SYNC_KV.put(key, JSON.stringify(record), { expirationTtl: HOMEBASE_TTL });
  } catch (error) {
    return json({ error: "KV-Write fehlgeschlagen", message: String(error?.message || error) }, 502);
  }
  return json({ ok: true, record });
}

function activeGroupMember(group, pilotId, now = Date.now()) {
  const id = normalizeOneLine(pilotId, 160);
  if (!id || !group || typeof group !== "object") return null;
  const kicked = new Set(Array.isArray(group.kicked) ? group.kicked.map((value) => String(value || "")) : []);
  if (kicked.has(id)) return null;
  const members = Array.isArray(group.members) ? group.members : [];
  return members.find((member) => {
    if (!member || String(member.syncId || "") !== id) return false;
    const lastSeen = normalizeFinite(member.lastSeen, 0, 0, now + 86400000);
    const timeout = member.isAdmin === true ? 365 * 86400000 : 28 * 86400000;
    return now - lastSeen < timeout;
  }) || null;
}

async function handleCrewHomebases(request, requestUrl, env) {
  if (!hasSyncKvBinding(env)) return json({ error: "Sync KV binding missing (GA_SYNC_KV)." }, 503);
  const groupName = normalizeOneLine(decodeURIComponent(requestUrl.pathname.split("/").filter(Boolean)[2] || ""), 80).toUpperCase();
  if (!groupName) return json({ error: "Ungültige Gruppe" }, 400);
  const auth = await verifySyncProfileAuth(request, env);
  if (!auth.ok) return auth.response;

  let group = null;
  try {
    const raw = await env.GA_SYNC_KV.get(`GROUP_${groupName}`);
    group = raw ? safeJsonParse(raw, null) : null;
  } catch (error) {
    return json({ error: "Gruppen-KV konnte nicht gelesen werden", message: String(error?.message || error) }, 502);
  }
  const requester = activeGroupMember(group, auth.ownerId);
  if (!requester) return json({ error: "Kein aktives Mitglied dieser Crew" }, 403);

  const now = Date.now();
  const members = (Array.isArray(group?.members) ? group.members : [])
    .map((member) => ({ member, active: activeGroupMember(group, member?.syncId, now) }))
    .filter(({ active }) => active);
  const bases = [];
  const directory = [];
  for (const { active } of members) {
    const pilotId = String(active.syncId || "");
    try {
      const raw = await env.GA_SYNC_KV.get(`${HOMEBASE_PREFIX}${pilotId}`);
      const record = raw ? safeJsonParse(raw, null) : null;
      const nick = normalizeOneLine(active.nick, 64) || "Pilot";
      if (!record?.plan) {
        directory.push({ pilotId, nick, hasHomebase: false, crewShareEnabled: false });
        continue;
      }
      const plan = normalizeHomebasePlan(record.plan);
      const crewShareEnabled = record.crewShareEnabled === true;
      directory.push({
        pilotId,
        nick,
        hasHomebase: crewShareEnabled,
        crewShareEnabled
      });
      if (!crewShareEnabled) continue;
      directory[directory.length - 1].updatedAt = normalizeFinite(record.updatedAt, 0, 0, now + 86400000);
      directory[directory.length - 1].spawn = plan.spawn;
      if (pilotId === auth.ownerId) continue;
      bases.push({
        pilotId,
        nick,
        revision: normalizeOneLine(record.revision, 100),
        updatedAt: normalizeFinite(record.updatedAt, 0, 0, now + 86400000),
        plan: { ...plan, objects: plan.objects.slice(0, HOMEBASE_CREW_OBJECTS_PER_BASE) }
      });
    } catch (error) {
      console.error("Crew homebase read failed:", pilotId, String(error?.message || error));
      directory.push({ pilotId, nick: normalizeOneLine(active.nick, 64) || "Pilot", hasHomebase: false, crewShareEnabled: false });
    }
  }
  return json({ ok: true, groupName, bases, directory, maxObjectsPerBase: HOMEBASE_CREW_OBJECTS_PER_BASE }, 200, { "Cache-Control": "no-store" });
}

function isoFromMs(ms) {
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

function clampNumber(value, min, max, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function dwdMinuteCoordToDecimal(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const sign = raw < 0 ? -1 : 1;
  const abs = Math.abs(raw);
  const deg = Math.trunc(abs);
  const min = (abs - deg) * 100;
  if (!Number.isFinite(min) || min < 0 || min >= 60.5) return raw;
  return sign * (deg + (min / 60));
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const toRad = Math.PI / 180;
  const lat1 = Number(aLat) * toRad;
  const lat2 = Number(bLat) * toRad;
  const dLat = (Number(bLat) - Number(aLat)) * toRad;
  const dLon = (Number(bLon) - Number(aLon)) * toRad;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) ** 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

function trimText(value, maxLen = 2000) {
  return String(value == null ? "" : value).trim().slice(0, maxLen);
}

function normalizeReportPayload(input) {
  const payload = input && typeof input === "object" ? input : {};
  return {
    title: trimText(payload.title || payload.summary || "Ohne Titel", 180),
    message: trimText(payload.message || payload.description || "", 8000),
    appVersion: trimText(payload.appVersion || "", 80),
    source: trimText(payload.source || "web", 80),
    context: payload.context && typeof payload.context === "object" ? payload.context : {},
    logs: Array.isArray(payload.logs) ? payload.logs.slice(0, 600) : [],
    transcripts: Array.isArray(payload.transcripts) ? payload.transcripts.slice(0, 200) : []
  };
}

function normalizeOneLine(value, maxLen = 200) {
  return trimText(value, maxLen).replace(/\s+/g, " ");
}

function normalizeCommunityId(value) {
  return normalizeOneLine(value, 96).replace(/[^\w:-]/g, "_").slice(0, 96);
}

function communityChecklistKey(id) {
  return `${COMMUNITY_CHECKLIST_PREFIX}${id}`;
}

function reverseTimestampKey(value) {
  const ts = Number.isFinite(Number(value)) ? Number(value) : Date.now();
  return String(9999999999999 - Math.max(0, Math.min(9999999999999, ts))).padStart(13, "0");
}

function communityIndexKey(id, updatedAt) {
  return `${COMMUNITY_CHECKLIST_INDEX_PREFIX}${reverseTimestampKey(updatedAt)}:${id}`;
}

function normalizeCommunityIndexItems(items, limit = 120) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(item => communityPublicMeta(item))
    .filter(item => {
      if (!item.id || !item.title || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, limit);
}

async function readCommunityAggregateIndex(env, limit = 120) {
  const raw = await env.GA_SYNC_KV.get(COMMUNITY_CHECKLIST_AGGREGATE_INDEX_KEY);
  if (!raw) return null;
  const parsed = raw ? safeJsonParse(raw, null) : null;
  return normalizeCommunityIndexItems(parsed && parsed.items, limit);
}

async function writeCommunityAggregateIndex(env, items) {
  const normalized = normalizeCommunityIndexItems(items, 120);
  await env.GA_SYNC_KV.put(COMMUNITY_CHECKLIST_AGGREGATE_INDEX_KEY, JSON.stringify({
    kind: "community-index-v2",
    updatedAt: Date.now(),
    count: normalized.length,
    items: normalized
  }));
  return normalized;
}

async function buildCommunityAggregateIndexFromLegacy(env, limit = 120) {
  const listed = await env.GA_SYNC_KV.list({ prefix: COMMUNITY_CHECKLIST_INDEX_PREFIX, limit });
  const items = [];
  for (const key of listed.keys || []) {
    try {
      const rawMeta = await env.GA_SYNC_KV.get(key.name);
      const meta = rawMeta ? safeJsonParse(rawMeta, null) : null;
      if (meta && meta.id && meta.title) items.push(communityPublicMeta(meta));
    } catch (error) {
      console.error("Community checklist index read failed:", key.name, String(error?.message || error));
    }
  }
  return writeCommunityAggregateIndex(env, items);
}

async function getCommunityIndexItems(env, limit = 120) {
  const aggregate = await readCommunityAggregateIndex(env, limit);
  if (aggregate) return aggregate;
  return buildCommunityAggregateIndexFromLegacy(env, limit);
}

async function upsertCommunityIndexMeta(env, meta) {
  let items = await readCommunityAggregateIndex(env, 120);
  if (!items) {
    try {
      items = await buildCommunityAggregateIndexFromLegacy(env, 120);
    } catch (_) {
      items = [];
    }
  }
  const normalized = communityPublicMeta(meta);
  const next = [normalized, ...items.filter(item => item.id !== normalized.id)];
  return writeCommunityAggregateIndex(env, next);
}

async function removeCommunityIndexMeta(env, id) {
  const normalizedId = normalizeCommunityId(id);
  let items = await readCommunityAggregateIndex(env, 120);
  if (!items) {
    try {
      items = await buildCommunityAggregateIndexFromLegacy(env, 120);
    } catch (_) {
      items = [];
    }
  }
  return writeCommunityAggregateIndex(env, items.filter(item => item.id !== normalizedId));
}

function communityPublicMeta(record) {
  const chapterCount = Array.isArray(record.chapters) ? record.chapters.length : Number(record.chapterCount || 0);
  const itemCount = Array.isArray(record.chapters)
    ? record.chapters.reduce((sum, chapter) => sum + (Array.isArray(chapter.items) ? chapter.items.length : 0), 0)
    : Number(record.itemCount || 0);
  return {
    id: normalizeCommunityId(record.id),
    title: normalizeOneLine(record.title || "Community Checkliste", 96),
    updatedAt: Number(record.updatedAt || 0),
    version: Number(record.version || 1),
    chapterCount,
    itemCount
  };
}

function communityPublicDetail(record) {
  const meta = communityPublicMeta(record);
  return {
    ...meta,
    chapters: (Array.isArray(record.chapters) ? record.chapters : []).map(chapter => ({
      id: normalizeCommunityId(chapter.id || `chapter-${meta.id}`),
      title: normalizeOneLine(chapter.title || "Kapitel", 64),
      items: (Array.isArray(chapter.items) ? chapter.items : []).map(item => ({
        id: normalizeCommunityId(item.id || `item-${meta.id}`),
        text: normalizeOneLine(item.text || "", 220)
      })).filter(item => item.text)
    })).filter(chapter => chapter.items.length)
  };
}

function normalizeCommunityChecklist(input, fallbackId = "") {
  const payload = input && typeof input === "object" ? input : {};
  const id = normalizeCommunityId(payload.id || fallbackId);
  if (!id) throw new Error("missing_id");
  const title = normalizeOneLine(payload.title, 96);
  if (!title) throw new Error("missing_title");
  const rawChapters = Array.isArray(payload.chapters) ? payload.chapters : [];
  if (!rawChapters.length) throw new Error("missing_chapters");

  let itemTotal = 0;
  const chapters = [];
  for (let chapterIndex = 0; chapterIndex < rawChapters.length && chapters.length < COMMUNITY_CHECKLIST_MAX_CHAPTERS; chapterIndex += 1) {
    const rawChapter = rawChapters[chapterIndex] || {};
    const chapterTitle = normalizeOneLine(rawChapter.title || `Kapitel ${chapterIndex + 1}`, 64);
    const rawItems = Array.isArray(rawChapter.items) ? rawChapter.items : [];
    const items = [];
    for (let itemIndex = 0; itemIndex < rawItems.length && itemTotal < COMMUNITY_CHECKLIST_MAX_ITEMS; itemIndex += 1) {
      const rawItem = rawItems[itemIndex] || {};
      const text = normalizeOneLine(rawItem.text, 220);
      if (!text) continue;
      items.push({
        id: normalizeCommunityId(rawItem.id || `item-${chapterIndex + 1}-${itemIndex + 1}`),
        text
      });
      itemTotal += 1;
    }
    if (items.length) {
      chapters.push({
        id: normalizeCommunityId(rawChapter.id || `chapter-${chapterIndex + 1}`),
        title: chapterTitle,
        items
      });
    }
  }

  if (!chapters.length || itemTotal < 1) throw new Error("missing_items");
  return {
    id,
    title,
    chapters,
    chapterCount: chapters.length,
    itemCount: itemTotal
  };
}

async function verifyChecklistCommunityAuth(request, env) {
  const requestedOwnerId = normalizeOneLine(request.headers.get("X-Pilot-ID"), 160);
  const pin = trimText(request.headers.get("X-Pilot-PIN"), 160);
  if (!requestedOwnerId || !pin) return { ok: false, response: json({ error: "Pilot-ID/PIN fehlen" }, 401) };

  const resolution = await resolveSyncPilotId(env, requestedOwnerId);
  const resolutionError = syncPilotResolutionError(resolution);
  if (resolutionError) return { ok: false, response: resolutionError };

  const profile = resolution.raw ? safeJsonParse(resolution.raw, null) : null;
  if (resolution.status !== "found" || !profile || String(profile.pin ?? "") !== pin) {
    return { ok: false, response: json({ error: "Falscher PIN oder Pilot-ID unbekannt" }, 401) };
  }

  return { ok: true, ownerId: resolution.pilotId };
}

async function verifySyncProfileAuth(request, env) {
  const requestedOwnerId = normalizeOneLine(request.headers.get("X-Pilot-ID"), 160);
  const pin = trimText(request.headers.get("X-Pilot-PIN"), 160);
  if (!requestedOwnerId || !pin) return { ok: false, response: json({ error: "Pilot-ID/PIN fehlen" }, 401) };

  const resolution = await resolveSyncPilotId(env, requestedOwnerId);
  const resolutionError = syncPilotResolutionError(resolution);
  if (resolutionError) return { ok: false, response: resolutionError };

  const profile = resolution.raw ? safeJsonParse(resolution.raw, null) : null;
  if (resolution.status !== "found" || !profile || String(profile.pin ?? "") !== pin) {
    return { ok: false, response: json({ error: "Falscher PIN oder Pilot-ID unbekannt" }, 401) };
  }

  return { ok: true, ownerId: resolution.pilotId };
}

async function getCommunityRecord(env, id) {
  const raw = await env.GA_SYNC_KV.get(communityChecklistKey(id));
  return raw ? safeJsonParse(raw, null) : null;
}

async function handleCommunityChecklists(request, requestUrl, env) {
  if (!hasSyncKvBinding(env) || typeof env.GA_SYNC_KV.delete !== "function" || typeof env.GA_SYNC_KV.list !== "function") {
    return json({ error: "Sync KV binding missing (GA_SYNC_KV)." }, 503);
  }

  const pathParts = requestUrl.pathname.split("/").filter(Boolean);
  const id = normalizeCommunityId(pathParts[3] || "");

  if (request.method === "GET") {
    if (id) {
      let record = null;
      try {
        record = await getCommunityRecord(env, id);
      } catch (error) {
        return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
      }
      if (!record) return json({ error: "Community-Checkliste nicht gefunden" }, 404);
      return json({ ok: true, checklist: communityPublicDetail(record) }, 200, { "Cache-Control": "no-store" });
    }

    const limit = clampNumber(requestUrl.searchParams.get("limit"), 1, 120, 80);
    let items = null;
    try {
      items = await getCommunityIndexItems(env, limit);
    } catch (error) {
      return json({ error: "KV-Index-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
    }
    return json({ ok: true, count: items.length, items }, 200, { "Cache-Control": "no-store" });
  }

  if (request.method === "POST") {
    const rawBody = await request.text();
    if (rawBody.length > COMMUNITY_CHECKLIST_MAX_BODY_BYTES) {
      return json({ error: "Zu groß" }, 413);
    }

    const incoming = safeJsonParse(rawBody, null);
    if (!incoming || typeof incoming !== "object") {
      return json({ error: "Ungültiges JSON" }, 400);
    }

    const auth = await verifyChecklistCommunityAuth(request, env);
    if (!auth.ok) return auth.response;

    const action = normalizeOneLine(incoming.action || "publish", 40).toLowerCase();
    if (action === "unpublish") {
      const targetId = normalizeCommunityId(incoming.id);
      if (!targetId) return json({ error: "ID fehlt" }, 400);
      let existing = null;
      try {
        existing = await getCommunityRecord(env, targetId);
      } catch (error) {
        return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
      }
      if (!existing) return json({ ok: true, id: targetId, unpublished: true, alreadyGone: true }, 200);
      if (existing.ownerId !== auth.ownerId) return json({ error: "Nur der Ersteller darf diese Checkliste ändern" }, 403);

      try {
        await env.GA_SYNC_KV.delete(communityChecklistKey(targetId));
        if (existing.indexKey) await env.GA_SYNC_KV.delete(existing.indexKey);
        await removeCommunityIndexMeta(env, targetId);
      } catch (error) {
        return json({ error: "KV-Delete fehlgeschlagen", message: String(error?.message || error) }, 502);
      }
      return json({ ok: true, id: targetId, unpublished: true }, 200);
    }

    if (action !== "publish") {
      return json({ error: "Unbekannte Aktion" }, 400);
    }

    let normalized = null;
    try {
      normalized = normalizeCommunityChecklist(incoming.checklist);
    } catch (error) {
      return json({ error: "Checkliste ungültig", code: String(error?.message || error) }, 400);
    }

    let existing = null;
    try {
      existing = await getCommunityRecord(env, normalized.id);
    } catch (error) {
      return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
    }
    if (existing && existing.ownerId !== auth.ownerId) {
      return json({ error: "Nur der Ersteller darf diese Checkliste ändern" }, 403);
    }

    const updatedAt = Date.now();
    const version = existing ? Number(existing.version || 1) + 1 : 1;
    const indexKey = communityIndexKey(normalized.id, updatedAt);
    const record = {
      id: normalized.id,
      ownerId: auth.ownerId,
      title: normalized.title,
      chapters: normalized.chapters,
      chapterCount: normalized.chapterCount,
      itemCount: normalized.itemCount,
      updatedAt,
      version,
      indexKey
    };
    const meta = communityPublicMeta(record);

    try {
      await env.GA_SYNC_KV.put(communityChecklistKey(normalized.id), JSON.stringify(record));
      if (existing?.indexKey && existing.indexKey !== indexKey) await env.GA_SYNC_KV.delete(existing.indexKey);
      await env.GA_SYNC_KV.put(indexKey, JSON.stringify(meta));
      await upsertCommunityIndexMeta(env, meta);
    } catch (error) {
      return json({ error: "KV-Write fehlgeschlagen", message: String(error?.message || error) }, 502);
    }

    return json({ ok: true, id: normalized.id, updatedAt, version }, 200);
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
}

function safePreview(value, maxLen = 300) {
  if (value == null) return "";
  if (typeof value === "string") return normalizeOneLine(value, maxLen);
  try {
    return normalizeOneLine(JSON.stringify(value), maxLen);
  } catch {
    return normalizeOneLine(String(value), maxLen);
  }
}

function buildBugMailText(report) {
  const ctx = report && typeof report.context === "object" ? report.context : {};
  const lines = [
    "Neuer Bug-Report eingegangen.",
    "",
    `ID: ${normalizeOneLine(report.id, 120)}`,
    `Zeitpunkt (UTC): ${normalizeOneLine(report.createdAt, 60)}`,
    `Titel: ${normalizeOneLine(report.title || "Ohne Titel", 220)}`,
    `Quelle: ${normalizeOneLine(report.source || "web", 60)}`,
    `Version: ${normalizeOneLine(report.appVersion || "-", 80)}`
  ];

  const device = normalizeOneLine(ctx.deviceType || ctx.platform || "", 120);
  const browser = normalizeOneLine(ctx.browser || ctx.userAgent || "", 260);
  const mission = normalizeOneLine(ctx.missionName || ctx.missionId || "", 160);
  const route = normalizeOneLine(ctx.routeSummary || "", 260);
  if (device) lines.push(`Gerät: ${device}`);
  if (browser) lines.push(`Browser: ${browser}`);
  if (mission) lines.push(`Mission: ${mission}`);
  if (route) lines.push(`Route: ${route}`);

  const msg = trimText(report.message || "", 3500);
  if (msg) {
    lines.push("", "Beschreibung:", msg);
  }

  const logs = Array.isArray(report.logs) ? report.logs : [];
  const transcripts = Array.isArray(report.transcripts) ? report.transcripts : [];
  lines.push("", `Anlagen: logs=${logs.length}, transcripts=${transcripts.length}`);
  if (logs.length) {
    lines.push("Log-Vorschau:");
    for (const entry of logs.slice(0, 6)) {
      lines.push(`- ${safePreview(entry, 240)}`);
    }
  }

  return lines.join("\n");
}

async function sendBugReportNotifications(report, env) {
  const webhookUrl = trimText(env && env.BUG_REPORT_NOTIFY_WEBHOOK_URL, 2000);
  const resendApiKey = trimText(env && env.RESEND_API_KEY, 400);
  const notifyEmailTo = trimText(env && env.BUG_REPORT_NOTIFY_EMAIL_TO, 400);
  const notifyEmailFrom = trimText(env && env.BUG_REPORT_NOTIFY_EMAIL_FROM, 200);
  const subjectPrefix = normalizeOneLine((env && env.BUG_REPORT_NOTIFY_SUBJECT_PREFIX) || "[GA Dispatcher]", 80);
  const mailSubject = `${subjectPrefix} Neuer Bugreport: ${normalizeOneLine(report.title || "Ohne Titel", 120)}`.slice(0, 240);
  const mailText = buildBugMailText(report);

  if (webhookUrl) {
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          event: "bug_report_created",
          report: {
            id: report.id,
            createdAt: report.createdAt,
            title: report.title,
            message: trimText(report.message || "", 1200),
            source: report.source || "web",
            appVersion: report.appVersion || "",
            status: report.status || "open",
            context: report.context || {},
            logCount: Array.isArray(report.logs) ? report.logs.length : 0,
            transcriptCount: Array.isArray(report.transcripts) ? report.transcripts.length : 0
          },
          mailDraft: {
            subject: mailSubject,
            text: mailText
          }
        })
      });
      if (!webhookRes.ok) {
        const bodyPreview = trimText(await webhookRes.text(), 300);
        console.error("Bug notify webhook failed:", webhookRes.status, bodyPreview);
      }
    } catch (error) {
      console.error("Bug notify webhook error:", String(error?.message || error));
    }
  }

  const hasResendConfig = !!(resendApiKey || notifyEmailTo || notifyEmailFrom);
  if (hasResendConfig) {
    if (!resendApiKey || !notifyEmailTo || !notifyEmailFrom) {
      console.warn("Bug mail notify skipped: incomplete Resend config (need RESEND_API_KEY + BUG_REPORT_NOTIFY_EMAIL_TO + BUG_REPORT_NOTIFY_EMAIL_FROM).");
      return;
    }

    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: notifyEmailFrom,
          to: [notifyEmailTo],
          subject: mailSubject,
          text: mailText
        })
      });
      if (!resendRes.ok) {
        const bodyPreview = trimText(await resendRes.text(), 500);
        console.error("Bug mail notify failed:", resendRes.status, bodyPreview);
      }
    } catch (error) {
      console.error("Bug mail notify error:", String(error?.message || error));
    }
  }
}

function getBugAdminTokenFromRequest(request, requestUrl) {
  const auth = request.headers.get("authorization") || "";
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  const hdrToken = request.headers.get("x-bug-admin-token");
  if (hdrToken) return hdrToken.trim();
  const qsToken = requestUrl.searchParams.get("token");
  if (qsToken) return qsToken.trim();
  return "";
}

function isBugAdminAuthorized(request, requestUrl, env) {
  const expected = trimText(env && env.BUG_TRACKER_ADMIN_TOKEN, 240);
  if (!expected) return true; // Falls kein Secret gesetzt ist, bleibt die Admin-API offen.
  const provided = getBugAdminTokenFromRequest(request, requestUrl);
  return !!provided && provided === expected;
}

function buildBugReportStorageKeys(id, createdAt) {
  const createdMs = Number.isFinite(Date.parse(createdAt)) ? Date.parse(createdAt) : Date.now();
  const reversed = String(9999999999999 - createdMs).padStart(13, "0");
  return {
    reportKey: `${BUG_REPORT_PREFIX}${id}`,
    openKey: `${BUG_OPEN_PREFIX}${reversed}:${id}`
  };
}

function projectBugListItem(report) {
  return {
    id: report.id,
    createdAt: report.createdAt,
    title: report.title,
    message: report.message,
    appVersion: report.appVersion || "",
    source: report.source || "",
    status: report.status || "open",
    context: report.context || {},
    logCount: Array.isArray(report.logs) ? report.logs.length : 0,
    transcriptCount: Array.isArray(report.transcripts) ? report.transcripts.length : 0
  };
}

function kvListLimit(value, fallback = 1000) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), ADMIN_KV_LIST_MAX);
}

async function listKvKeys(env, options = {}) {
  const prefix = String(options.prefix || "");
  const requestedLimit = kvListLimit(options.limit, 1000);
  const perPage = Math.min(1000, requestedLimit);
  const keys = [];
  let cursor = "";
  let listComplete = true;
  let pages = 0;

  do {
    const request = { prefix, limit: Math.min(perPage, requestedLimit - keys.length) };
    if (cursor) request.cursor = cursor;
    const listed = await env.GA_SYNC_KV.list(request);
    const pageKeys = Array.isArray(listed?.keys) ? listed.keys : [];
    keys.push(...pageKeys);
    cursor = String(listed?.cursor || "");
    listComplete = listed?.list_complete !== false;
    pages++;
  } while (keys.length < requestedLimit && cursor && !listComplete && pages < 20);

  return {
    keys: keys.slice(0, requestedLimit),
    listComplete: listComplete && !cursor,
    cursor
  };
}

function isReservedSyncKvKey(keyName) {
  const name = String(keyName || "");
  return !name
    || name.startsWith("GROUP_")
    || name.startsWith(BUG_REPORT_PREFIX)
    || name.startsWith(BUG_OPEN_PREFIX)
    || name.startsWith(HOMEBASE_PREFIX)
    || name.startsWith(COMMUNITY_CHECKLIST_PREFIX)
    || name.startsWith(COMMUNITY_CHECKLIST_INDEX_PREFIX)
    || name === COMMUNITY_CHECKLIST_AGGREGATE_INDEX_KEY;
}

function normalizePilotIdLookup(value) {
  return normalizeOneLine(value, 160).normalize("NFKC").toLowerCase();
}

function canonicalNewPilotId(value) {
  return normalizeOneLine(value, 160).normalize("NFKC").toUpperCase();
}

async function resolveSyncPilotId(env, requestedPilotId) {
  const requested = normalizeOneLine(requestedPilotId, 160);
  const lookup = normalizePilotIdLookup(requested);
  if (!requested || !lookup || requested.startsWith("GROUP_") || isReservedSyncKvKey(requested)) {
    return { status: "invalid", pilotId: "", raw: null };
  }

  let exactRaw = null;
  try {
    exactRaw = await env.GA_SYNC_KV.get(requested);
  } catch (error) {
    return { status: "error", error, pilotId: "", raw: null };
  }
  if (exactRaw) return { status: "found", pilotId: requested, raw: exactRaw };

  if (typeof env.GA_SYNC_KV.list !== "function") return { status: "missing", pilotId: "", raw: null };

  let listed;
  try {
    listed = await listKvKeys(env, { limit: ADMIN_KV_LIST_MAX });
  } catch (error) {
    return { status: "error", error, pilotId: "", raw: null };
  }
  const matches = (listed.keys || [])
    .map(key => String(key?.name || ""))
    .filter(key => !isReservedSyncKvKey(key) && normalizePilotIdLookup(key) === lookup);
  if (matches.length > 1) return { status: "collision", pilotId: "", raw: null };
  if (!matches.length) return { status: "missing", pilotId: "", raw: null };

  try {
    const raw = await env.GA_SYNC_KV.get(matches[0]);
    return raw
      ? { status: "found", pilotId: matches[0], raw }
      : { status: "missing", pilotId: "", raw: null };
  } catch (error) {
    return { status: "error", error, pilotId: "", raw: null };
  }
}

function syncPilotResolutionError(resolution) {
  if (resolution?.status === "invalid") return json({ ok: false, code: "invalid_pilot_id", error: "Ungültige Pilot-ID" }, 400);
  if (resolution?.status === "collision") return json({ ok: false, code: "pilot_id_collision", error: "Pilot-ID ist nicht eindeutig" }, 409);
  if (resolution?.status === "error") return json({ ok: false, code: "kv_read_failed", error: "KV-Read fehlgeschlagen", message: String(resolution.error?.message || resolution.error) }, 502);
  return null;
}

async function handlePilotAuthVerify(request, env) {
  if (!hasSyncKvBinding(env) || typeof env.GA_SYNC_KV.list !== "function") {
    return json({ ok: false, code: "sync_unavailable", error: "Sync KV binding missing (GA_SYNC_KV)." }, 503);
  }
  if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed", error: "Method not allowed" }, 405);

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ ok: false, code: "request_too_large", error: "Anfrage zu groß" }, 413);
    payload = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, code: "invalid_json", error: "Ungültiges JSON" }, 400);
  }

  const requestedPilotId = normalizeOneLine(payload?.pilotId, 160);
  const pin = trimText(payload?.pin, 160);
  if (!requestedPilotId || !pin) return json({ ok: false, code: "credentials_missing", error: "Pilot-ID/PIN fehlen" }, 400);

  const resolution = await resolveSyncPilotId(env, requestedPilotId);
  const resolutionError = syncPilotResolutionError(resolution);
  if (resolutionError) return resolutionError;
  if (resolution.status === "missing") return json({ ok: false, code: "pilot_not_found", error: "Pilot-ID nicht gefunden" }, 404);

  const profile = safeJsonParse(resolution.raw, null);
  if (!profile || String(profile.pin ?? "") !== pin) {
    return json({ ok: false, code: "pin_invalid", error: "PIN ist falsch" }, 401);
  }

  return json({ ok: true, pilotId: resolution.pilotId }, 200, {
    "Cache-Control": "no-store",
    "X-Pilot-ID": resolution.pilotId
  });
}

function pickString(...values) {
  for (const value of values) {
    const str = trimText(value, 240);
    if (str) return str;
  }
  return "";
}

function isLikelySyncUserRecord(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (typeof data.pin === "string" || typeof data.pin === "number") return true;
  return !!(
    data.registeredAt
    || data.registeredAtMs
    || data.lastModified
    || Array.isArray(data.pinboard)
    || Array.isArray(data.logbook)
    || Array.isArray(data.flights)
    || data.activeMission
    || data.profile
  );
}

function projectSyncUser(keyName, data) {
  const registeredMs = parseDateMs(data.registeredAt)
    || parseDateMs(data.registeredAtMs)
    || parseDateMs(data.createdAt)
    || parseDateMs(data.createdAtMs)
    || parseDateMs(data.firstSeenAt)
    || parseDateMs(data.firstSeenAtMs);
  const lastModifiedMs = parseDateMs(data.lastModified)
    || parseDateMs(data.updatedAt)
    || parseDateMs(data.savedAt);
  const profile = data.profile && typeof data.profile === "object" ? data.profile : {};
  const name = pickString(
    profile.name,
    profile.displayName,
    data.pilotName,
    data.displayName,
    data.name,
    data.groupNick,
    data.syncId,
    keyName
  );

  return {
    id: String(keyName || ""),
    name: name || String(keyName || ""),
    registeredAt: isoFromMs(registeredMs),
    registrationKnown: !!registeredMs,
    lastModified: isoFromMs(lastModifiedMs),
    hasPinboard: Array.isArray(data.pinboard) && data.pinboard.length > 0,
    hasLogbook: Array.isArray(data.logbook) && data.logbook.length > 0,
    hasActiveMission: !!data.activeMission
  };
}

async function handleAdminUsers(request, requestUrl, env) {
  if (!hasSyncKvBinding(env) || typeof env.GA_SYNC_KV.list !== "function") {
    return json({
      error: "Sync KV binding missing (GA_SYNC_KV). Add KV binding in worker settings or wrangler.toml."
    }, 503);
  }
  if (!isBugAdminAuthorized(request, requestUrl, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const limit = kvListLimit(requestUrl.searchParams.get("limit"), 1000);
  const listed = await listKvKeys(env, { limit: Math.min(ADMIN_KV_LIST_MAX, Math.max(limit * 4, limit)) });
  const items = [];
  let scanned = 0;

  for (const key of listed.keys || []) {
    const keyName = String(key?.name || "");
    scanned++;
    if (isReservedSyncKvKey(keyName)) continue;
    let raw = null;
    try {
      raw = await env.GA_SYNC_KV.get(keyName);
    } catch {
      continue;
    }
    const data = safeJsonParse(raw, null);
    if (!isLikelySyncUserRecord(data)) continue;
    items.push(projectSyncUser(keyName, data));
    if (items.length >= limit) break;
  }

  items.sort((a, b) => {
    const bReg = parseDateMs(b.registeredAt) || parseDateMs(b.lastModified) || 0;
    const aReg = parseDateMs(a.registeredAt) || parseDateMs(a.lastModified) || 0;
    if (bReg !== aReg) return bReg - aReg;
    return String(a.name || a.id).localeCompare(String(b.name || b.id), "de");
  });

  return json({
    ok: true,
    count: items.length,
    scanned,
    truncated: items.length >= limit || !listed.listComplete,
    items
  }, 200, { "Cache-Control": "no-store" });
}

function bugOpenCreatedMsFromKey(keyName) {
  const part = String(keyName || "").slice(BUG_OPEN_PREFIX.length).split(":")[0];
  const reversed = Number(part);
  if (!Number.isFinite(reversed)) return null;
  const createdMs = 9999999999999 - reversed;
  return Number.isFinite(createdMs) && createdMs > 0 ? createdMs : null;
}

async function handleBugReportPurge(request, requestUrl, env) {
  if (!hasSyncKvBinding(env) || typeof env.GA_SYNC_KV.list !== "function" || typeof env.GA_SYNC_KV.delete !== "function") {
    return json({
      error: "Sync KV binding missing (GA_SYNC_KV). Add KV binding in worker settings or wrangler.toml."
    }, 503);
  }
  if (!isBugAdminAuthorized(request, requestUrl, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await request.text();
  const payload = rawBody ? safeJsonParse(rawBody, {}) : {};
  const olderThanDays = clampNumber(
    payload?.olderThanDays ?? requestUrl.searchParams.get("olderThanDays"),
    0,
    3650,
    30
  );
  const includeUnknown = !!(payload && payload.includeUnknown);
  const dryRun = payload?.dryRun !== false && requestUrl.searchParams.get("dryRun") !== "false";
  const limit = kvListLimit(payload?.limit ?? requestUrl.searchParams.get("limit"), ADMIN_KV_LIST_MAX);
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const keysToDelete = new Set();
  const reportIdsToDelete = new Set();
  let scannedReports = 0;
  let scannedOpenKeys = 0;
  let unknownDateReports = 0;

  const reportKeys = await listKvKeys(env, { prefix: BUG_REPORT_PREFIX, limit });
  for (const key of reportKeys.keys || []) {
    const keyName = String(key?.name || "");
    scannedReports++;
    let raw = null;
    try {
      raw = await env.GA_SYNC_KV.get(keyName);
    } catch {
      raw = null;
    }
    const report = safeJsonParse(raw, null) || {};
    const id = trimText(report.id, 160) || keyName.slice(BUG_REPORT_PREFIX.length);
    const createdMs = parseDateMs(report.createdAt);
    if (!createdMs) unknownDateReports++;
    if ((createdMs && createdMs < cutoffMs) || (!createdMs && includeUnknown)) {
      keysToDelete.add(keyName);
      if (id) reportIdsToDelete.add(id);
      if (report.openKey) keysToDelete.add(String(report.openKey));
    }
  }

  const openKeys = await listKvKeys(env, { prefix: BUG_OPEN_PREFIX, limit });
  for (const key of openKeys.keys || []) {
    const keyName = String(key?.name || "");
    scannedOpenKeys++;
    const id = keyName.split(":").pop();
    const createdMs = bugOpenCreatedMsFromKey(keyName);
    if ((id && reportIdsToDelete.has(id)) || (createdMs && createdMs < cutoffMs)) {
      keysToDelete.add(keyName);
    }
  }

  let deleted = 0;
  if (!dryRun) {
    for (const keyName of keysToDelete) {
      try {
        await env.GA_SYNC_KV.delete(keyName);
        deleted++;
      } catch (error) {
        return json({ ok: false, error: "KV-Delete fehlgeschlagen", key: keyName, message: String(error?.message || error) }, 502);
      }
    }
  }

  return json({
    ok: true,
    dryRun,
    olderThanDays,
    cutoff: isoFromMs(cutoffMs),
    scannedReports,
    scannedOpenKeys,
    unknownDateReports,
    matchedKeys: keysToDelete.size,
    deleted,
    truncated: !reportKeys.listComplete || !openKeys.listComplete,
    sampleKeys: Array.from(keysToDelete).slice(0, 80)
  }, 200, { "Cache-Control": "no-store" });
}

async function handleProblemReports(request, requestUrl, env, ctx) {
  if (!hasSyncKvBinding(env)) {
    return json({
      error: "Sync KV binding missing (GA_SYNC_KV). Add KV binding in worker settings or wrangler.toml."
    }, 503);
  }

  const pathParts = requestUrl.pathname.split("/").filter(Boolean);
  // /api/problem-reports
  // /api/problem-reports/:id
  // /api/problem-reports/:id/ack
  const reportId = pathParts[2] || "";
  const subAction = pathParts[3] || "";

  if (reportId === "purge") {
    return handleBugReportPurge(request, requestUrl, env);
  }

  if (request.method === "POST" && !reportId) {
    const rawBody = await request.text();
    if (rawBody.length > BUG_MAX_BODY_BYTES) {
      return json({ ok: false, error: "Zu groß" }, 413);
    }
    const incoming = safeJsonParse(rawBody, null);
    if (!incoming || typeof incoming !== "object") {
      return json({ ok: false, error: "Ungültiges JSON" }, 400);
    }

    const normalized = normalizeReportPayload(incoming);
    const createdAt = nowIso();
    const id = trimText(incoming.id, 80) || crypto.randomUUID();
    const keys = buildBugReportStorageKeys(id, createdAt);
    const report = {
      id,
      createdAt,
      updatedAt: createdAt,
      status: "open",
      ackedAt: null,
      ackedBy: "",
      ackNote: "",
      openKey: keys.openKey,
      ...normalized
    };

    try {
      await env.GA_SYNC_KV.put(keys.reportKey, JSON.stringify(report), { expirationTtl: BUG_REPORT_TTL });
      await env.GA_SYNC_KV.put(keys.openKey, JSON.stringify({
        id,
        createdAt,
        title: report.title,
        source: report.source,
        appVersion: report.appVersion
      }), { expirationTtl: BUG_REPORT_TTL });
    } catch (error) {
      return json({ ok: false, error: "KV-Write fehlgeschlagen", message: String(error?.message || error) }, 502);
    }

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(sendBugReportNotifications(report, env));
    } else {
      await sendBugReportNotifications(report, env);
    }

    return json({ ok: true, id, createdAt }, 201);
  }

  // Ab hier: Admin-Operationen
  if (!isBugAdminAuthorized(request, requestUrl, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (request.method === "GET" && !reportId) {
    const status = trimText(requestUrl.searchParams.get("status") || "open", 20).toLowerCase();
    const limitRaw = Number.parseInt(requestUrl.searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);

    if (status !== "open") {
      return json({ ok: false, error: "Nur status=open wird aktuell unterstützt" }, 400);
    }

    let list;
    try {
      list = await env.GA_SYNC_KV.list({ prefix: BUG_OPEN_PREFIX, limit });
    } catch (error) {
      return json({ ok: false, error: "KV-List fehlgeschlagen", message: String(error?.message || error) }, 502);
    }

    const items = [];
    for (const key of list.keys || []) {
      const id = String(key.name || "").split(":").pop();
      if (!id) continue;
      let rawReport = null;
      try {
        rawReport = await env.GA_SYNC_KV.get(`${BUG_REPORT_PREFIX}${id}`);
      } catch {
        continue;
      }
      if (!rawReport) continue;
      const report = safeJsonParse(rawReport, null);
      if (!report || report.status !== "open") continue;
      items.push(projectBugListItem(report));
    }

    return json({
      ok: true,
      status: "open",
      count: items.length,
      items
    }, 200, { "Cache-Control": "no-store" });
  }

  if (request.method === "GET" && reportId) {
    let rawReport = null;
    try {
      rawReport = await env.GA_SYNC_KV.get(`${BUG_REPORT_PREFIX}${reportId}`);
    } catch (error) {
      return json({ ok: false, error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
    }
    if (!rawReport) return json({ ok: false, error: "Nicht gefunden" }, 404);
    return new Response(rawReport, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }

  if (request.method === "POST" && reportId && subAction === "ack") {
    const rawBody = await request.text();
    const payload = safeJsonParse(rawBody, {});
    const ackedBy = trimText(payload && payload.ackedBy, 80);
    const ackNote = trimText(payload && payload.note, 600);

    const reportKey = `${BUG_REPORT_PREFIX}${reportId}`;
    let rawReport = null;
    try {
      rawReport = await env.GA_SYNC_KV.get(reportKey);
    } catch (error) {
      return json({ ok: false, error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
    }
    if (!rawReport) return json({ ok: false, error: "Nicht gefunden" }, 404);

    const report = safeJsonParse(rawReport, null);
    if (!report) return json({ ok: false, error: "Datenformat ungültig" }, 500);
    if (report.status === "acked") return json({ ok: true, id: reportId, alreadyAcked: true });

    report.status = "acked";
    report.ackedAt = nowIso();
    report.updatedAt = report.ackedAt;
    report.ackedBy = ackedBy;
    report.ackNote = ackNote;

    try {
      await env.GA_SYNC_KV.put(reportKey, JSON.stringify(report), { expirationTtl: BUG_REPORT_TTL });
      if (report.openKey) await env.GA_SYNC_KV.delete(report.openKey);
    } catch (error) {
      return json({ ok: false, error: "KV-Write fehlgeschlagen", message: String(error?.message || error) }, 502);
    }

    return json({ ok: true, id: reportId, ackedAt: report.ackedAt });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
}

function parseMosmixStationCatalog(text) {
  const stations = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    const m = /^(\S{4,5})\s+(\S{4})\s+(.{20})\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+)/.exec(line);
    if (!m) continue;
    const lat = dwdMinuteCoordToDecimal(m[4]);
    const lon = dwdMinuteCoordToDecimal(m[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stations.push({
      id: m[1],
      icao: m[2] === "----" ? "" : m[2],
      name: String(m[3] || "").trim(),
      lat,
      lon,
      elevM: Number.parseInt(m[6], 10)
    });
  }
  return stations;
}

async function getMosmixStationCatalog() {
  const now = Date.now();
  if (Array.isArray(mosmixStationCatalogCache) && mosmixStationCatalogCache.length && (now - mosmixStationCatalogAt) < 12 * 60 * 60 * 1000) {
    return mosmixStationCatalogCache;
  }
  const res = await fetch(MOSMIX_STATION_CATALOG_URL, {
    headers: {
      "User-Agent": "GA-Dispatcher-MOSMIX/1.0",
      "Accept": "text/plain,*/*"
    },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`MOSMIX station catalog HTTP ${res.status}`);
  const text = await res.text();
  const stations = parseMosmixStationCatalog(text);
  if (!stations.length) throw new Error("MOSMIX station catalog empty");
  mosmixStationCatalogCache = stations;
  mosmixStationCatalogAt = now;
  return stations;
}

function findNearestMosmixStation(stations, lat, lon) {
  let best = null;
  let bestKm = Infinity;
  for (const st of stations || []) {
    const km = distanceKm(lat, lon, st.lat, st.lon);
    if (km < bestKm) {
      best = st;
      bestKm = km;
    }
  }
  if (!best || bestKm > MOSMIX_NEAREST_MAX_KM) return null;
  return { ...best, distKm: Math.round(bestKm * 10) / 10 };
}

function readZipU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readZipU32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

async function inflateRawZipEntry(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractFirstKmlFromKmz(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
    if (readZipU32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("KMZ central directory missing");
  const count = readZipU16(bytes, eocd + 10);
  let ptr = readZipU32(bytes, eocd + 16);
  for (let i = 0; i < count && ptr < bytes.length - 46; i++) {
    if (readZipU32(bytes, ptr) !== 0x02014b50) break;
    const method = readZipU16(bytes, ptr + 10);
    const compressedSize = readZipU32(bytes, ptr + 20);
    const nameLen = readZipU16(bytes, ptr + 28);
    const extraLen = readZipU16(bytes, ptr + 30);
    const commentLen = readZipU16(bytes, ptr + 32);
    const localOffset = readZipU32(bytes, ptr + 42);
    const name = new TextDecoder("utf-8").decode(bytes.slice(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;
    if (!/\.kml$/i.test(name)) continue;
    if (readZipU32(bytes, localOffset) !== 0x04034b50) continue;
    const localNameLen = readZipU16(bytes, localOffset + 26);
    const localExtraLen = readZipU16(bytes, localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = bytes.slice(start, start + compressedSize);
    let raw;
    if (method === 0) raw = compressed;
    else if (method === 8) raw = await inflateRawZipEntry(compressed);
    else throw new Error(`KMZ compression method ${method} unsupported`);
    return new TextDecoder("iso-8859-1").decode(raw);
  }
  throw new Error("KMZ contains no KML entry");
}

function parseMosmixValues(raw) {
  return String(raw || "").trim().split(/\s+/).map(v => {
    if (!v || v === "-" || v === "--") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
}

function extractMosmixElement(xml, name) {
  const re = new RegExp(`<dwd:Forecast\\s+[^>]*dwd:elementName=["']${name}["'][^>]*>[\\s\\S]*?<dwd:value>([\\s\\S]*?)<\\/dwd:value>`, "i");
  const m = re.exec(xml);
  return m ? parseMosmixValues(m[1]) : [];
}

function parseMosmixKml(xml) {
  const times = [];
  const timeRe = /<dwd:TimeStep>([^<]+)<\/dwd:TimeStep>/g;
  let tm;
  while ((tm = timeRe.exec(xml)) !== null) {
    const ms = Date.parse(tm[1]);
    if (Number.isFinite(ms)) times.push(Math.round(ms / 1000));
  }
  if (!times.length) throw new Error("MOSMIX forecast has no time steps");
  const elements = {};
  for (const name of MOSMIX_ELEMENTS) {
    elements[name] = extractMosmixElement(xml, name);
  }
  return { times, elements };
}

async function fetchMosmixStationData(stationId) {
  const id = String(stationId || "").trim();
  if (!/^[A-Z0-9]{4,5}$/.test(id)) throw new Error("invalid MOSMIX station id");
  const now = Date.now();
  const mem = mosmixStationDataCache.get(id);
  if (mem && (now - mem.ts) < 45 * 60 * 1000) return mem.data;

  const cache = (typeof caches !== "undefined" && caches && caches.default) ? caches.default : null;
  const cacheKey = new Request(`https://cache.local/mosmix/station/${encodeURIComponent(id)}`);
  const hit = cache ? await cache.match(cacheKey) : null;
  if (hit) {
    const data = await hit.json();
    mosmixStationDataCache.set(id, { ts: now, data });
    return data;
  }

  const url = `${MOSMIX_SINGLE_BASE}/${encodeURIComponent(id)}/kml/MOSMIX_L_LATEST_${encodeURIComponent(id)}.kmz`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "GA-Dispatcher-MOSMIX/1.0",
      "Accept": "application/vnd.google-earth.kmz,application/zip,*/*"
    },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`MOSMIX station ${id} HTTP ${res.status}`);
  const xml = await extractFirstKmlFromKmz(await res.arrayBuffer());
  const data = parseMosmixKml(xml);
  mosmixStationDataCache.set(id, { ts: now, data });
  while (mosmixStationDataCache.size > MOSMIX_MAX_STATIONS) {
    const oldest = mosmixStationDataCache.keys().next().value;
    if (!oldest) break;
    mosmixStationDataCache.delete(oldest);
  }
  if (cache) await cache.put(cacheKey, json(data, 200, { "Cache-Control": "public, max-age=1800" }));
  return data;
}

function pickNearestMosmixIndex(times, targetSec) {
  if (!Array.isArray(times) || !times.length) return -1;
  const target = Number.isFinite(Number(targetSec)) ? Number(targetSec) : Math.round(Date.now() / 1000);
  let best = 0;
  let diff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = Number(times[i]);
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - target);
    if (d < diff) {
      best = i;
      diff = d;
    }
  }
  return best;
}

function mosmixValueAt(stationData, key, idx) {
  const arr = stationData && stationData.elements && stationData.elements[key];
  if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return null;
  const n = Number(arr[idx]);
  return Number.isFinite(n) ? n : null;
}

function buildMosmixParts(stationData, idx) {
  if (!stationData || idx < 0) return null;
  return {
    time: Number(stationData.times[idx]),
    visibilityM: mosmixValueAt(stationData, "VV", idx),
    n05Pct: mosmixValueAt(stationData, "N05", idx),
    lowCloudPct: mosmixValueAt(stationData, "Nl", idx),
    midCloudPct: mosmixValueAt(stationData, "Nm", idx),
    highCloudPct: mosmixValueAt(stationData, "Nh", idx),
    totalCloudPct: mosmixValueAt(stationData, "N", idx),
    precipitationMm: mosmixValueAt(stationData, "RR1c", idx),
    weatherCode: mosmixValueAt(stationData, "WPc11", idx)
  };
}

async function runLimited(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const n = Math.max(1, Math.min(Number(limit) || 4, items.length || 1));
  const runners = Array.from({ length: n }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}

function parseMosmixRequestPayload(raw) {
  const payload = raw && typeof raw === "object" ? raw : {};
  const points = Array.isArray(payload.points) ? payload.points : [];
  const targets = Array.isArray(payload.targets) ? payload.targets : [];
  return {
    points: points.slice(0, MOSMIX_MAX_POINTS).map((p, idx) => ({
      idx,
      lat: clampNumber(p && p.lat, -90, 90, null),
      lon: clampNumber(p && (p.lon ?? p.lng), -180, 180, null)
    })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
    targets: targets.slice(0, MOSMIX_MAX_TARGETS).map(t => Math.round(Number(t))).filter(Number.isFinite)
  };
}

async function handleMosmixProxy(request, requestUrl) {
  let payload = null;
  if (request.method === "POST") {
    payload = safeJsonParse(await request.text(), null);
  } else {
    const pointsRaw = String(requestUrl.searchParams.get("points") || "");
    const targetsRaw = String(requestUrl.searchParams.get("targets") || "");
    payload = {
      points: pointsRaw.split(";").map(pair => {
        const [lat, lon] = pair.split(",").map(Number);
        return { lat, lon };
      }),
      targets: targetsRaw.split(",").map(Number)
    };
  }
  const parsed = parseMosmixRequestPayload(payload);
  if (!parsed.points.length) return json({ ok: false, errorCode: "invalid_points" }, 400);
  const targets = parsed.targets.length ? parsed.targets : [Math.round(Date.now() / 1000)];
  const stations = await getMosmixStationCatalog();

  const nearestByPoint = parsed.points.map(p => ({ point: p, station: findNearestMosmixStation(stations, p.lat, p.lon) }));
  const stationIds = Array.from(new Set(nearestByPoint.map(x => x.station && x.station.id).filter(Boolean))).slice(0, MOSMIX_MAX_STATIONS);
  const stationDataById = Object.create(null);
  await runLimited(stationIds, 8, async (id) => {
    try {
      stationDataById[id] = await fetchMosmixStationData(id);
    } catch (error) {
      stationDataById[id] = { error: String(error?.message || error) };
    }
  });

  const points = nearestByPoint.map(({ point, station }) => {
    if (!station) return { lat: point.lat, lon: point.lon, ok: false, errorCode: "no_station_nearby" };
    const stationData = stationDataById[station.id];
    if (!stationData || stationData.error) {
      return { lat: point.lat, lon: point.lon, ok: false, station, errorCode: "station_unavailable", message: stationData && stationData.error };
    }
    const currentIdx = pickNearestMosmixIndex(stationData.times, Math.round(Date.now() / 1000));
    return {
      lat: point.lat,
      lon: point.lon,
      ok: true,
      station,
      source: "DWD MOSMIX_L",
      current: buildMosmixParts(stationData, currentIdx),
      targets: targets.map(target => {
        const idx = pickNearestMosmixIndex(stationData.times, target);
        return {
          target,
          ...buildMosmixParts(stationData, idx)
        };
      })
    };
  });

  return json({
    ok: true,
    source: "DWD MOSMIX_L",
    attribution: "Datenbasis: Deutscher Wetterdienst (DWD), MOSMIX_L; eigene Verarbeitung",
    generatedAt: nowIso(),
    count: points.length,
    points
  }, 200, { "Cache-Control": "public, max-age=300" });
}

function normalizeTileKey(raw) {
  const v = String(raw || "").trim();
  if (!/^-?\d+\|-?\d+$/.test(v)) return null;
  return v;
}

function splitTileKey(tileKey) {
  const [latI, lonI] = String(tileKey || "").split("|").map(Number);
  if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return null;
  return { latI: Math.trunc(latI), lonI: Math.trunc(lonI) };
}

function normalizeObstacleLayer(raw) {
  const layer = String(raw || "").trim().toLowerCase();
  if (!layer || layer === "v1" || layer === "legacy") return "core";
  if (layer === "core" || layer === "poi" || layer === "infra") return layer;
  return null;
}

function buildObstacleTileUrl(base, tileKey) {
  const key = normalizeTileKey(tileKey);
  if (!key) return null;
  const parts = splitTileKey(key);
  if (!parts) return null;
  const cleanBase = String(base || "").replace(/\/+$/, "");
  if (!cleanBase) return null;
  return `${cleanBase}/${parts.latI}/${parts.lonI}.json`;
}

function buildObstacleTileCandidates(env, tileKey, layer) {
  const legacyBase = String((env && env.OBSTACLE_TILES_BASE) || DEFAULT_OBS_TILE_BASE).replace(/\/+$/, "");
  const coreBase = String((env && env.OBSTACLE_CORE_TILES_BASE) || legacyBase || DEFAULT_OBS_CORE_TILE_BASE).replace(/\/+$/, "");
  const poiBase = String((env && env.OBSTACLE_POI_TILES_BASE) || DEFAULT_OBS_POI_TILE_BASE).replace(/\/+$/, "");
  const infraBase = String((env && env.OBSTACLE_INFRA_TILES_BASE) || DEFAULT_OBS_INFRA_TILE_BASE).replace(/\/+$/, "");

  function gz(url) { return url ? url.replace(/\.json$/, ".json.gz") : null; }

  if (layer === "poi") {
    const poiUrl = buildObstacleTileUrl(poiBase, tileKey);
    const candidates = [];
    if (poiUrl) candidates.push({ layer: "poi", sourceKind: "split", url: gz(poiUrl), compressed: true });
    if (poiUrl) candidates.push({ layer: "poi", sourceKind: "split", url: poiUrl });
    return candidates;
  }

  if (layer === "infra") {
    const infraUrl = buildObstacleTileUrl(infraBase, tileKey);
    const candidates = [];
    if (infraUrl) candidates.push({ layer: "infra", sourceKind: "split", url: gz(infraUrl), compressed: true });
    if (infraUrl) candidates.push({ layer: "infra", sourceKind: "split", url: infraUrl });
    return candidates;
  }

  const candidates = [];
  const coreUrl = buildObstacleTileUrl(coreBase, tileKey);
  if (coreUrl) candidates.push({ layer: "core", sourceKind: "split", url: gz(coreUrl), compressed: true });
  if (coreUrl) candidates.push({ layer: "core", sourceKind: "split", url: coreUrl });
  const legacyUrl = buildObstacleTileUrl(legacyBase, tileKey);
  if (legacyUrl && legacyUrl !== coreUrl) {
    candidates.push({ layer: "core", sourceKind: "legacy", url: gz(legacyUrl), compressed: true });
    candidates.push({ layer: "core", sourceKind: "legacy", url: legacyUrl });
  }
  return candidates;
}

async function handleObstacleTile(request, requestUrl, env) {
  const tileKey = normalizeTileKey(requestUrl.searchParams.get("tile"));
  if (!tileKey) return json({ ok: false, errorCode: "invalid_tile" }, 400);
  const layer = normalizeObstacleLayer(requestUrl.searchParams.get("layer"));
  if (!layer) return json({ ok: false, tile: tileKey, errorCode: "invalid_layer" }, 400);
  const refreshRaw = String(requestUrl.searchParams.get("refresh") || "").toLowerCase();
  const forceRefresh = refreshRaw === "1" || refreshRaw === "true" || refreshRaw === "yes";
  const candidates = buildObstacleTileCandidates(env, tileKey, layer);
  if (!candidates.length) return json({ ok: false, errorCode: "invalid_tile" }, 400);

  const cacheKey = new Request(`https://cache.local/obstacles/tile?tile=${encodeURIComponent(tileKey)}&layer=${encodeURIComponent(layer)}`);
  const cache = caches.default;
  const useCache = request.method === "GET" && !forceRefresh;
  if (useCache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  let chosen = null;
  let upstreamErr = null;
  let payload = null;
  let obs = [], lin = [], poi = [], infraPoi = [], infraClusters = [];
  for (const c of candidates) {
    try {
      const res = await fetch(c.url, {
        method: "GET",
        headers: {
          "User-Agent": "GA-Dispatcher-ObstacleTileProxy/1.0",
          "Accept": "application/json"
        },
        redirect: "follow"
      });
      if (res.status === 404 || res.status === 204) continue;
      if (!res.ok) continue;
      let p;
      try {
        let text;
        if (c.compressed) {
          const buf = await res.arrayBuffer();
          const ds = new DecompressionStream("gzip");
          const writer = ds.writable.getWriter();
          writer.write(new Uint8Array(buf));
          writer.close();
          text = await new Response(ds.readable).text();
        } else {
          text = await res.text();
        }
        p = JSON.parse(text);
      } catch { continue; }
      const cObj = p && typeof p.core === "object" ? p.core : null;
      const pObj = p && typeof p.poi === "object" ? p.poi : null;
      const iObj = p && typeof p.infra === "object" ? p.infra : null;
      const o = Array.isArray(p?.obs) ? p.obs : (Array.isArray(cObj?.obs) ? cObj.obs : []);
      const l = Array.isArray(p?.lin) ? p.lin : (Array.isArray(cObj?.lin) ? cObj.lin : []);
      const pi = Array.isArray(p?.poi) ? p.poi : (Array.isArray(pObj?.poi) ? pObj.poi : []);
      const ip = Array.isArray(iObj?.poi) ? iObj.poi : [];
      const ic = Array.isArray(iObj?.clusters) ? iObj.clusters : [];
      if (layer === "infra" && ip.length === 0 && ic.length === 0) continue;
      if (layer !== "poi" && layer !== "infra" && o.length === 0 && l.length === 0) continue;
      chosen = c;
      payload = p;
      obs = o;
      lin = l;
      poi = pi;
      infraPoi = ip;
      infraClusters = ic;
      break;
    } catch (error) {
      upstreamErr = error;
    }
  }

  if (!chosen) {
    if (upstreamErr) {
      return json({ ok: false, tile: tileKey, layer, errorCode: "upstream_failed", message: String(upstreamErr?.message || upstreamErr) }, 502);
    }
    const missRes = json(
      { ok: false, tile: tileKey, layer, errorCode: "not_found", forceRefresh },
      404,
      { "Cache-Control": forceRefresh ? "no-store" : "public, max-age=900" }
    );
    if (useCache) await cache.put(cacheKey, missRes.clone());
    return missRes;
  }

  const body = {
    ok: true,
    tile: tileKey,
    layer,
    source: chosen && chosen.sourceKind === "legacy" ? "github-hosted-legacy" : "github-hosted",
    sourceKind: chosen ? chosen.sourceKind : "split",
    forceRefresh,
    version: Number(payload?.version || payload?.v || 1),
    updatedAt: payload?.updatedAt || payload?.generatedAt || null
  };
  if (layer === "poi") {
    body.poi = { poi };
  } else if (layer === "infra") {
    body.infra = { poi: infraPoi, clusters: infraClusters };
  } else {
    body.core = { obs, lin };
    // Legacy compatibility for clients expecting flat obs/lin.
    body.obs = obs;
    body.lin = lin;
  }

  const response = json({
    ...body
  }, 200, { "Cache-Control": forceRefresh ? "no-store" : "public, max-age=3600" });

  if (useCache) await cache.put(cacheKey, response.clone());
  return response;
}

function buildMetarUpstreamUrl(requestUrl) {
  const src = String(requestUrl.searchParams.get("src") || "").trim();
  if (src) {
    const srcUrl = safeUrl(src);
    if (!srcUrl || srcUrl.protocol !== "https:") return null;
    if (srcUrl.hostname !== "aviationweather.gov") return null;
    if (!srcUrl.pathname.startsWith("/api/data/metar")) return null;
    srcUrl.searchParams.set("format", "json");
    return srcUrl.toString();
  }

  const ids = String(requestUrl.searchParams.get("ids") || "").trim();
  const bbox = String(requestUrl.searchParams.get("bbox") || "").trim();
  if (!ids && !bbox) return null;
  const u = new URL("https://aviationweather.gov/api/data/metar");
  if (ids) u.searchParams.set("ids", ids);
  if (bbox) u.searchParams.set("bbox", bbox);
  u.searchParams.set("format", "json");
  return u.toString();
}

async function handleMetarProxy(requestUrl) {
  const upstreamUrl = buildMetarUpstreamUrl(requestUrl);
  if (!upstreamUrl) return json({ ok: false, errorCode: "invalid_metar_query" }, 400);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "User-Agent": "GA-Dispatcher-MetarProxy/1.0",
        "Accept": "application/json"
      },
      redirect: "follow"
    });
  } catch (error) {
    return json({ ok: false, errorCode: "upstream_failed", message: String(error?.message || error) }, 502);
  }

  const text = await upstream.text();
  const ct = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  return new Response(text, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": ct,
      "Cache-Control": "public, max-age=30"
    }
  });
}

function normalizeIcao(raw) {
  return String(raw || "").trim().toUpperCase();
}

function normalizeCountry(raw) {
  const cc = String(raw || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : "";
}

function resolveAipCountryCode(icao, fallbackCountry = "") {
  const cc = normalizeCountry(fallbackCountry);
  if (cc && AIP_POPUP_ROUTES[cc]) return cc;

  const code = normalizeIcao(icao);
  if (code.startsWith("LO")) return "AT";
  if (code.startsWith("LF")) return "FR";
  if (code.startsWith("EH")) return "NL";
  if (code.startsWith("EG")) return "GB";
  if (code.startsWith("ED") || code.startsWith("ET")) return "DE";
  return null;
}

function buildAipSourcePageUrl(icao, country = "") {
  const code = normalizeIcao(icao);
  if (!/^[A-Z0-9]{4}$/.test(code)) return null;
  const cc = resolveAipCountryCode(code, country);
  if (!cc) return null;
  return `https://aip.aero${AIP_POPUP_ROUTES[cc]}?${encodeURIComponent(code)}=`;
}

function safeUrl(url, base = "") {
  try {
    return base ? new URL(url, base) : new URL(url);
  } catch {
    return null;
  }
}

function isAllowedFileHost(url) {
  const u = safeUrl(url);
  if (!u || u.protocol !== "https:") return false;
  return FILE_ALLOWED_HOSTS.has(u.hostname) || u.hostname.endsWith(".dfs.de");
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unique(arr) {
  return [...new Set(arr)];
}

function extractDfsLinksFromAipHtml(html) {
  const text = String(html || "");
  const matches = [];
  let m;

  const hrefRx = /href\s*=\s*["']([^"']+)["']/gi;
  while ((m = hrefRx.exec(text)) !== null) {
    const v = htmlDecode(m[1]);
    if (/^https:\/\/aip\.dfs\.de\/.+\.html(?:[?#].*)?$/i.test(v)) matches.push(v);
  }

  const plainRx = /https:\/\/aip\.dfs\.de\/[^\s"'<>]+\.html(?:[?#][^\s"'<>]*)?/gi;
  while ((m = plainRx.exec(text)) !== null) matches.push(m[0]);

  return unique(matches);
}

function chartKindFromUrl(url) {
  const u = safeUrl(url);
  if (!u) return null;
  const p = u.pathname.toLowerCase();
  if (p.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(p)) return "image";
  return null;
}

function scoreChartCandidate(url) {
  const u = safeUrl(url);
  if (!u) return -999;
  const path = `${u.hostname}${u.pathname}`.toLowerCase();
  const pathname = u.pathname.toLowerCase();
  const filename = pathname.split("/").pop() || "";
  const kind = chartKindFromUrl(url);
  let score = 0;

  if (kind === "pdf") score += 120;
  if (kind === "image") score += 20;
  if (/chart|vac|approach|visual|aip|ad-?2|vfr|ifr/.test(path)) score += 40;
  if (/chart|vac|approach|ad-?2|plate/.test(filename)) score += 45;
  if (/\/charts?\//.test(pathname)) score += 30;
  if (/\/chapter\//.test(pathname)) score -= 25;
  if (/\/img\//.test(pathname)) score -= 160;
  if (/^[a-z]{2}\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(filename)) score -= 220;
  if (/^(de|en|fr|nl|at|gb|uk)\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(filename)) score -= 260;
  if (/logo|icon|favicon|sprite|banner|thumb|apple-touch|flag|flags|locale|language/.test(path)) score -= 260;
  if (u.pathname.toLowerCase().endsWith(".svg")) score -= 80;
  if (/aip\.dfs\.de|secais\.dfs\.de|dfs\.de/.test(u.hostname)) score += 30;
  if (!isAllowedFileHost(url)) score -= 120;

  return score;
}

function extractChartCandidateFromDfsHtml(html, dfsPageUrl) {
  const text = String(html || "");
  const candidates = [];
  let m;

  const attrRx = /(href|src)\s*=\s*["']([^"']+)["']/gi;
  while ((m = attrRx.exec(text)) !== null) {
    const raw = htmlDecode(m[2]);
    const abs = safeUrl(raw, dfsPageUrl);
    if (!abs) continue;
    const kind = chartKindFromUrl(abs.toString());
    if (!kind) continue;
    candidates.push({ chartKind: kind, chartUrl: abs.toString() });
  }

  const plainRx = /https:\/\/[^\s"'<>]+\.(pdf|png|jpe?g|webp|gif|bmp|svg)(?:\?[^\s"'<>]*)?/gi;
  while ((m = plainRx.exec(text)) !== null) {
    const abs = safeUrl(m[0]);
    if (!abs) continue;
    const kind = chartKindFromUrl(abs.toString());
    if (!kind) continue;
    candidates.push({ chartKind: kind, chartUrl: abs.toString() });
  }

  const ranked = unique(candidates.map(c => `${c.chartKind}|${c.chartUrl}`))
    .map(v => {
      const [chartKind, chartUrl] = v.split("|");
      return { chartKind, chartUrl, score: scoreChartCandidate(chartUrl) };
    })
    .sort((a, b) => b.score - a.score);

  if (!ranked.length || ranked[0].score < 0) return null;
  return { chartKind: ranked[0].chartKind, chartUrl: ranked[0].chartUrl };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "GA-Dispatcher-AIP-Resolver/1.0",
      "Accept": "text/html,application/xhtml+xml"
    },
    redirect: "follow"
  });
  return { res, body: await res.text() };
}

async function handleAipResolve(requestUrl) {
  const icao = normalizeIcao(requestUrl.searchParams.get("icao"));
  const country = normalizeCountry(requestUrl.searchParams.get("country"));

  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    return json({ ok: false, errorCode: "invalid_icao" }, 400);
  }

  const sourcePage = buildAipSourcePageUrl(icao, country);
  if (!sourcePage) {
    return json({
      ok: false,
      icao,
      sourcePage: null,
      dfsLink: null,
      chartKind: null,
      chartUrl: null,
      title: null,
      errorCode: "unsupported_country"
    }, 400);
  }

  const aipFetch = await fetchHtml(sourcePage).catch(() => null);
  if (!aipFetch || !aipFetch.res.ok) {
    return json({
      ok: false,
      icao,
      sourcePage,
      dfsLink: null,
      chartKind: null,
      chartUrl: null,
      title: null,
      errorCode: "not_found"
    }, 502);
  }

  const dfsLinks = extractDfsLinksFromAipHtml(aipFetch.body);
  if (!dfsLinks.length) {
    return json({
      ok: false,
      icao,
      sourcePage,
      dfsLink: null,
      chartKind: null,
      chartUrl: null,
      title: null,
      errorCode: "not_found"
    }, 404);
  }

  const chartCandidates = [];
  let firstAllowedDfs = null;

  for (const dfsLink of dfsLinks) {
    if (!isAllowedFileHost(dfsLink)) continue;
    if (!firstAllowedDfs) firstAllowedDfs = dfsLink;

    const dfsFetch = await fetchHtml(dfsLink).catch(() => null);
    if (!dfsFetch || !dfsFetch.res.ok) continue;

    const titleMatch = dfsFetch.body.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? htmlDecode(titleMatch[1]).trim() : `${icao} AIP Chart`;

    const chart = extractChartCandidateFromDfsHtml(dfsFetch.body, dfsLink);
    if (!chart || !chart.chartUrl || !chart.chartKind) continue;
    if (!isAllowedFileHost(chart.chartUrl)) continue;

    chartCandidates.push({
      dfsLink,
      chartKind: chart.chartKind,
      chartUrl: chart.chartUrl,
      title
    });
  }

  if (!chartCandidates.length) {
    return json({
      ok: false,
      icao,
      sourcePage,
      dfsLink: firstAllowedDfs,
      chartKind: null,
      chartUrl: null,
      title: null,
      errorCode: firstAllowedDfs ? "unsupported_format" : "blocked"
    }, 404);
  }

  const best = chartCandidates[0];
  return json({
    ok: true,
    icao,
    sourcePage,
    dfsLink: best.dfsLink,
    chartKind: best.chartKind,
    chartUrl: best.chartUrl,
    title: best.title,
    chartCandidates: chartCandidates.map(c => ({
      dfsLink: c.dfsLink,
      chartKind: c.chartKind,
      chartUrl: c.chartUrl,
      title: c.title
    })),
    errorCode: null
  }, 200, { "Cache-Control": "public, max-age=1800" });
}

async function handleAipFile(requestUrl) {
  const target = requestUrl.searchParams.get("url");
  if (!target) return json({ ok: false, errorCode: "missing_url" }, 400);
  if (!isAllowedFileHost(target)) return json({ ok: false, errorCode: "blocked" }, 403);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "GA-Dispatcher-AIP-Resolver/1.0" }
    });
  } catch (error) {
    return json({ ok: false, errorCode: "upstream_failed", message: String(error?.message || error) }, 502);
  }

  if (!upstream.ok) {
    return json({ ok: false, errorCode: "not_found", status: upstream.status }, 404);
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const contentLength = upstream.headers.get("content-length");
  const headers = {
    ...corsHeaders,
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=1800"
  };
  if (contentLength) headers["Content-Length"] = contentLength;

  return new Response(upstream.body, { status: 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === "/api/tracker/download" && (request.method === "GET" || request.method === "HEAD")) {
      return handleTrackerDownload(requestUrl);
    }

    if (requestUrl.pathname === "/api/admin/users") {
      return handleAdminUsers(request, requestUrl, env);
    }

    if (requestUrl.pathname === "/api/auth/verify") {
      return handlePilotAuthVerify(request, env);
    }

    if (requestUrl.pathname.startsWith("/api/homebase-group/")) {
      return handleCrewHomebases(request, requestUrl, env);
    }

    if (requestUrl.pathname.startsWith("/api/homebase/")) {
      return handleHomebaseSync(request, requestUrl, env);
    }

    // ==========================================
    // 1. CLOUD-SYNC (MIT STRIKTER PIN-PRÜFUNG)
    // ==========================================
    if (requestUrl.pathname.startsWith("/api/sync/")) {
      if (!hasSyncKvBinding(env)) {
        return json({
          error: "Sync KV binding missing (GA_SYNC_KV). Add KV binding in worker settings or wrangler.toml."
        }, 503);
      }
      const pathParts = requestUrl.pathname.split("/").filter(Boolean);
      const pilotId = decodeURIComponent(pathParts[2] || "");
      const isGroupKey = typeof pilotId === "string" && pilotId.startsWith("GROUP_");

      if (!pilotId) {
        return json({ error: "Keine ID angegeben" }, 400);
      }

      if (isGroupKey) {
        const auth = await verifySyncProfileAuth(request, env);
        if (!auth.ok) return auth.response;
      }

      if (request.method === "GET") {
        let rawData = null;
        let storagePilotId = pilotId;
        if (isGroupKey) {
          try {
            rawData = await env.GA_SYNC_KV.get(pilotId);
          } catch (error) {
            return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
          }
        } else {
          const resolution = await resolveSyncPilotId(env, pilotId);
          const resolutionError = syncPilotResolutionError(resolution);
          if (resolutionError) return resolutionError;
          if (resolution.status === "found") {
            storagePilotId = resolution.pilotId;
            rawData = resolution.raw;
          }
        }
        if (!rawData) {
          return json({ error: "Leer oder abgelaufen" }, 404);
        }

        try {
          const storedData = JSON.parse(rawData);
          const requestPin = requestUrl.searchParams.get("pin");

          if (!isGroupKey && storedData.pin && storedData.pin !== requestPin) {
            return json({ error: "Falscher PIN" }, 401);
          }

          return new Response(rawData, { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Pilot-ID": storagePilotId } });
        } catch {
          return json({ error: "Datenformat ungültig" }, 500);
        }
      }

      if (request.method === "POST") {
        let rawBody = await request.text();
        if (rawBody.length > 100 * 1024) {
          return json({ error: "Zu groß" }, 413);
        }

        try {
          const incomingData = JSON.parse(rawBody);
          let existingRaw = null;
          let storagePilotId = pilotId;
          if (isGroupKey) {
            try {
              existingRaw = await env.GA_SYNC_KV.get(pilotId);
            } catch (error) {
              return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
            }
          } else {
            const resolution = await resolveSyncPilotId(env, pilotId);
            const resolutionError = syncPilotResolutionError(resolution);
            if (resolutionError) return resolutionError;
            if (resolution.status === "found") {
              storagePilotId = resolution.pilotId;
              existingRaw = resolution.raw;
            } else {
              storagePilotId = canonicalNewPilotId(pilotId);
            }
          }

          if (existingRaw) {
            const existingData = JSON.parse(existingRaw);
            if (!isGroupKey && existingData.pin && existingData.pin !== incomingData.pin) {
              return json({ error: "Falscher PIN" }, 401);
            }
            if (!isGroupKey) {
              const registeredAt = isoFromMs(parseDateMs(existingData.registeredAt) || parseDateMs(existingData.createdAt) || parseDateMs(existingData.firstSeenAt));
              const registeredAtMs = parseDateMs(existingData.registeredAtMs) || parseDateMs(registeredAt);
              if (registeredAt && !incomingData.registeredAt) incomingData.registeredAt = registeredAt;
              if (registeredAtMs && !incomingData.registeredAtMs) incomingData.registeredAtMs = registeredAtMs;
              incomingData.syncId = storagePilotId;
              rawBody = JSON.stringify(incomingData);
            }
          } else if (!isGroupKey) {
            const registeredAt = nowIso();
            incomingData.registeredAt = registeredAt;
            incomingData.registeredAtMs = Date.parse(registeredAt);
            incomingData.syncId = storagePilotId;
            rawBody = JSON.stringify(incomingData);
          }

          try {
            await env.GA_SYNC_KV.put(storagePilotId, rawBody, { expirationTtl: 31536000 });
          } catch (error) {
            return json({ error: "KV-Write fehlgeschlagen", message: String(error?.message || error) }, 502);
          }
          return json({ success: true, pilotId: storagePilotId }, 200, { "X-Pilot-ID": storagePilotId });
        } catch {
          return json({ error: "Ungültiges JSON beim Speichern" }, 400);
        }
      }

      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // ==========================================
    // 2. AIP CHART RESOLVER / FILE PROXY
    // ==========================================
    if (requestUrl.pathname === "/api/aip-chart/resolve" && request.method === "GET") {
      return handleAipResolve(requestUrl);
    }

    if (requestUrl.pathname === "/api/aip-chart/file" && request.method === "GET") {
      return handleAipFile(requestUrl);
    }

    // ==========================================
    // 3. OBSTACLE TILE PROXY (GitHub-hosted tiles)
    // ==========================================
    if (requestUrl.pathname === "/api/obstacles/tile" && request.method === "GET") {
      return handleObstacleTile(request, requestUrl, env);
    }

    // ==========================================
    // 4. METAR PROXY (AviationWeather CORS-stabil)
    // ==========================================
    if (requestUrl.pathname === "/api/metar" && request.method === "GET") {
      return handleMetarProxy(requestUrl);
    }

    // ==========================================
    // 5. MOSMIX PROXY (DWD Open Data, reduced JSON)
    // ==========================================
    if (requestUrl.pathname === "/api/mosmix" && (request.method === "GET" || request.method === "POST")) {
      return handleMosmixProxy(request, requestUrl);
    }

    // ==========================================
    // 6. CHECKLIST COMMUNITY API
    // ==========================================
    if (requestUrl.pathname === "/api/checklists/community" || requestUrl.pathname.startsWith("/api/checklists/community/")) {
      return handleCommunityChecklists(request, requestUrl, env);
    }

    // ==========================================
    // 7. PROBLEM REPORTS (Mini Bugtracker API)
    // ==========================================
    if (requestUrl.pathname === "/api/problem-reports" || requestUrl.pathname.startsWith("/api/problem-reports/")) {
      return handleProblemReports(request, requestUrl, env, ctx);
    }

    // ==========================================
    // 8. OPENAIP PROXY (Catch-All für Snapping)
    // ==========================================
    let targetPath = requestUrl.pathname;
    if (targetPath.includes("/v1/")) {
      targetPath = targetPath.replace("/v1/", "/api/");
    }

    const targetUrl = new URL(`https://api.core.openaip.net${targetPath}`);
    requestUrl.searchParams.forEach((value, key) => targetUrl.searchParams.append(key, value));
    targetUrl.searchParams.append("apiKey", OPENAIP_KEY);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (error) {
      return json({ error: String(error?.message || error) }, 500);
    }
  }
};
