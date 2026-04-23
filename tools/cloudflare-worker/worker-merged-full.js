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

  if (layer === "poi") {
    const poiUrl = buildObstacleTileUrl(poiBase, tileKey);
    return poiUrl ? [{ layer: "poi", sourceKind: "split", url: poiUrl }] : [];
  }

  const candidates = [];
  const coreUrl = buildObstacleTileUrl(coreBase, tileKey);
  if (coreUrl) candidates.push({ layer: "core", sourceKind: "split", url: coreUrl });
  const legacyUrl = buildObstacleTileUrl(legacyBase, tileKey);
  if (legacyUrl && legacyUrl !== coreUrl) candidates.push({ layer: "core", sourceKind: "legacy", url: legacyUrl });
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

  let upstream = null;
  let chosen = null;
  let upstreamErr = null;
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
      upstream = res;
      chosen = c;
      break;
    } catch (error) {
      upstreamErr = error;
    }
  }

  if (!upstream) {
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
  if (!upstream.ok) {
    return json({ ok: false, tile: tileKey, layer, errorCode: "upstream_error", status: upstream.status }, 502);
  }

  const payloadText = await upstream.text();
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return json({ ok: false, tile: tileKey, layer, errorCode: "invalid_json" }, 502);
  }

  const coreObj = payload && typeof payload.core === "object" ? payload.core : null;
  const poiObj = payload && typeof payload.poi === "object" ? payload.poi : null;
  const obs = Array.isArray(payload?.obs) ? payload.obs : (Array.isArray(coreObj?.obs) ? coreObj.obs : []);
  const lin = Array.isArray(payload?.lin) ? payload.lin : (Array.isArray(coreObj?.lin) ? coreObj.lin : []);
  const poi = Array.isArray(payload?.poi) ? payload.poi : (Array.isArray(poiObj?.poi) ? poiObj.poi : []);

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
    // 5. OPENAIP PROXY (Catch-All für Snapping)
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
