const OPENAIP_KEY = "049026a617e1380ac056e1fd3cc237ae";
const DEFAULT_OBS_TILE_BASE = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/obstacles/tiles";
const DEFAULT_OBS_CORE_TILE_BASE = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/obstacles/core-tiles";
const DEFAULT_OBS_POI_TILE_BASE = "https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/obstacles/poi-tiles";

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
  "Access-Control-Allow-Headers": "*"
};

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

function hasSyncKvBinding(env) {
  return !!(env && env.GA_SYNC_KV && typeof env.GA_SYNC_KV.get === "function" && typeof env.GA_SYNC_KV.put === "function");
}

const BUG_REPORT_PREFIX = "bug:report:";
const BUG_OPEN_PREFIX = "bug:open:";
const BUG_REPORT_TTL = 180 * 24 * 60 * 60; // 180 Tage
const BUG_MAX_BODY_BYTES = 350 * 1024;

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

async function handleProblemReports(request, requestUrl, env) {
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
  if (layer === "core" || layer === "poi") return layer;
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

  function gz(url) { return url ? url.replace(/\.json$/, ".json.gz") : null; }

  if (layer === "poi") {
    const poiUrl = buildObstacleTileUrl(poiBase, tileKey);
    const candidates = [];
    if (poiUrl) candidates.push({ layer: "poi", sourceKind: "split", url: gz(poiUrl), compressed: true });
    if (poiUrl) candidates.push({ layer: "poi", sourceKind: "split", url: poiUrl });
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
  let obs = [], lin = [], poi = [];
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
      const o = Array.isArray(p?.obs) ? p.obs : (Array.isArray(cObj?.obs) ? cObj.obs : []);
      const l = Array.isArray(p?.lin) ? p.lin : (Array.isArray(cObj?.lin) ? cObj.lin : []);
      const pi = Array.isArray(p?.poi) ? p.poi : (Array.isArray(pObj?.poi) ? pObj.poi : []);
      if (layer !== "poi" && o.length === 0 && l.length === 0) continue;
      chosen = c;
      payload = p;
      obs = o;
      lin = l;
      poi = pi;
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
      const pilotId = pathParts[2];

      if (!pilotId) {
        return json({ error: "Keine ID angegeben" }, 400);
      }

      if (request.method === "GET") {
        let rawData = null;
        try {
          rawData = await env.GA_SYNC_KV.get(pilotId);
        } catch (error) {
          return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
        }
        if (!rawData) {
          return json({ error: "Leer oder abgelaufen" }, 404);
        }

        try {
          const storedData = JSON.parse(rawData);
          const requestPin = requestUrl.searchParams.get("pin");

          if (storedData.pin && storedData.pin !== requestPin) {
            return json({ error: "Falscher PIN" }, 401);
          }

          return new Response(rawData, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch {
          return json({ error: "Datenformat ungültig" }, 500);
        }
      }

      if (request.method === "POST") {
        const rawBody = await request.text();
        if (rawBody.length > 100 * 1024) {
          return json({ error: "Zu groß" }, 413);
        }

        try {
          const incomingData = JSON.parse(rawBody);
          let existingRaw = null;
          try {
            existingRaw = await env.GA_SYNC_KV.get(pilotId);
          } catch (error) {
            return json({ error: "KV-Read fehlgeschlagen", message: String(error?.message || error) }, 502);
          }

          if (existingRaw) {
            const existingData = JSON.parse(existingRaw);
            if (existingData.pin && existingData.pin !== incomingData.pin) {
              return json({ error: "Falscher PIN" }, 401);
            }
          }

          try {
            await env.GA_SYNC_KV.put(pilotId, rawBody, { expirationTtl: 31536000 });
          } catch (error) {
            return json({ error: "KV-Write fehlgeschlagen", message: String(error?.message || error) }, 502);
          }
          return json({ success: true }, 200);
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
    // 5. PROBLEM REPORTS (Mini Bugtracker API)
    // ==========================================
    if (requestUrl.pathname === "/api/problem-reports" || requestUrl.pathname.startsWith("/api/problem-reports/")) {
      return handleProblemReports(request, requestUrl, env);
    }

    // ==========================================
    // 6. OPENAIP PROXY (Catch-All für Snapping)
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
