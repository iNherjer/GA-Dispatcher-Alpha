/**
 * Cloudflare Worker – AIP Chart Resolver + File Proxy
 *
 * Endpoints:
 *   GET /api/aip-chart/resolve?icao=EDTW&country=DE
 *   GET /api/aip-chart/file?url=https%3A%2F%2F...
 */

const AIP_POPUP_ROUTES = {
  AT: '/at/en/vfr/',
  DE: '/de/en/vfr/',
  FR: '/fr/aeroports/',
  GB: '/uk/vfr/',
  NL: '/nl/en/vfr/'
};

const FILE_ALLOWED_HOSTS = new Set([
  'aip.aero',
  'aip.dfs.de',
  'secais.dfs.de',
  'dfs.de',
  'www.dfs.de'
]);

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

function withCors(headers = {}) {
  return { ...CORS_HEADERS, ...headers };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: withCors({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    })
  });
}

function normalizeIcao(raw) {
  return String(raw || '').trim().toUpperCase();
}

function normalizeCountry(raw) {
  const cc = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : '';
}

function resolveAipCountryCode(icao, fallbackCountry = '') {
  const cc = normalizeCountry(fallbackCountry);
  if (cc && AIP_POPUP_ROUTES[cc]) return cc;

  const code = normalizeIcao(icao);
  if (code.startsWith('LO')) return 'AT';
  if (code.startsWith('LF')) return 'FR';
  if (code.startsWith('EH')) return 'NL';
  if (code.startsWith('EG')) return 'GB';
  if (code.startsWith('ED') || code.startsWith('ET')) return 'DE';
  return null;
}

function buildAipSourcePageUrl(icao, country = '') {
  const code = normalizeIcao(icao);
  if (!/^[A-Z0-9]{4}$/.test(code)) return null;
  const cc = resolveAipCountryCode(code, country);
  if (!cc) return null;
  const route = AIP_POPUP_ROUTES[cc];
  return `https://aip.aero${route}?${encodeURIComponent(code)}=`;
}

function safeUrl(url, base = '') {
  try {
    if (base) return new URL(url, base);
    return new URL(url);
  } catch (e) {
    return null;
  }
}

function isAllowedFileHost(url) {
  const u = safeUrl(url);
  if (!u || u.protocol !== 'https:') return false;
  if (FILE_ALLOWED_HOSTS.has(u.hostname)) return true;
  return u.hostname.endsWith('.dfs.de');
}

function htmlDecode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function uniq(arr) {
  return [...new Set(arr)];
}

export function extractDfsLinksFromAipHtml(html) {
  const text = String(html || '');
  const matches = [];

  const hrefRx = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRx.exec(text)) !== null) {
    const v = htmlDecode(m[1]);
    if (/^https:\/\/aip\.dfs\.de\/.+\.html(?:[?#].*)?$/i.test(v)) matches.push(v);
  }

  const plainRx = /https:\/\/aip\.dfs\.de\/[^\s"'<>]+\.html(?:[?#][^\s"'<>]*)?/gi;
  while ((m = plainRx.exec(text)) !== null) {
    matches.push(m[0]);
  }

  return uniq(matches);
}

function normalizeChartKindFromUrl(url) {
  const u = safeUrl(url);
  if (!u) return null;
  const p = u.pathname.toLowerCase();
  if (p.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(p)) return 'image';
  return null;
}

function scoreChartCandidate(url) {
  const u = safeUrl(url);
  if (!u) return -1000;
  const path = `${u.hostname}${u.pathname}`.toLowerCase();
  const pathname = u.pathname.toLowerCase();
  const filename = pathname.split('/').pop() || '';
  const extKind = normalizeChartKindFromUrl(url);
  let score = 0;

  if (extKind === 'pdf') score += 120;
  if (extKind === 'image') score += 20;
  if (/chart|vac|approach|visual|aip|ad-?2|vfr|ifr/.test(path)) score += 40;
  if (/chart|vac|approach|ad-?2|plate/.test(filename)) score += 45;
  if (/\/charts?\//.test(pathname)) score += 30;
  if (/\/chapter\//.test(pathname)) score -= 25;
  if (/\/img\//.test(pathname)) score -= 160;
  if (/^[a-z]{2}\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(filename)) score -= 220;
  if (/^(de|en|fr|nl|at|gb|uk)\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(filename)) score -= 260;
  if (/logo|icon|favicon|sprite|banner|thumb|apple-touch|flag|flags|locale|language/.test(path)) score -= 260;
  if (u.pathname.toLowerCase().endsWith('.svg')) score -= 80;
  if (/aip\.dfs\.de|secais\.dfs\.de|dfs\.de/.test(u.hostname)) score += 30;
  if (!isAllowedFileHost(url)) score -= 120;

  return score;
}

export function extractChartCandidateFromDfsHtml(html, dfsPageUrl) {
  const text = String(html || '');
  const candidates = [];

  const attrRx = /(href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRx.exec(text)) !== null) {
    const raw = htmlDecode(m[2]);
    const abs = safeUrl(raw, dfsPageUrl);
    if (!abs) continue;
    const kind = normalizeChartKindFromUrl(abs.toString());
    if (!kind) continue;
    candidates.push({ chartUrl: abs.toString(), chartKind: kind });
  }

  const plainRx = /https:\/\/[^\s"'<>]+\.(pdf|png|jpe?g|webp|gif|bmp|svg)(?:\?[^\s"'<>]*)?/gi;
  while ((m = plainRx.exec(text)) !== null) {
    const abs = safeUrl(m[0]);
    if (!abs) continue;
    const kind = normalizeChartKindFromUrl(abs.toString());
    if (!kind) continue;
    candidates.push({ chartUrl: abs.toString(), chartKind: kind });
  }

  const ranked = uniq(candidates.map(c => `${c.chartKind}|${c.chartUrl}`))
    .map(v => {
      const [chartKind, chartUrl] = v.split('|');
      return { chartKind, chartUrl, score: scoreChartCandidate(chartUrl) };
    })
    .sort((a, b) => b.score - a.score);

  if (!ranked.length || ranked[0].score < 0) return null;
  return { chartKind: ranked[0].chartKind, chartUrl: ranked[0].chartUrl };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'GA-Dispatcher-AIP-Resolver/1.0 (+Cloudflare Worker)',
      'accept': 'text/html,application/xhtml+xml'
    },
    redirect: 'follow'
  });
  const body = await res.text();
  return { res, body };
}

async function handleResolve(requestUrl) {
  const icao = normalizeIcao(requestUrl.searchParams.get('icao'));
  const country = normalizeCountry(requestUrl.searchParams.get('country'));
  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    return json({ ok: false, errorCode: 'invalid_icao' }, 400);
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
      errorCode: 'unsupported_country'
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
      errorCode: 'not_found'
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
      errorCode: 'not_found'
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
      errorCode: firstAllowedDfs ? 'unsupported_format' : 'blocked'
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
  }, 200, { 'cache-control': 'public, max-age=1800' });
}

async function handleFile(requestUrl) {
  const target = requestUrl.searchParams.get('url');
  if (!target) return json({ ok: false, errorCode: 'missing_url' }, 400);
  if (!isAllowedFileHost(target)) return json({ ok: false, errorCode: 'blocked' }, 403);

  let upstream;
  try {
    upstream = await fetch(target, {
      redirect: 'follow',
      headers: {
        'user-agent': 'GA-Dispatcher-AIP-Resolver/1.0 (+Cloudflare Worker)'
      }
    });
  } catch (e) {
    return json({ ok: false, errorCode: 'upstream_failed' }, 502);
  }

  if (!upstream.ok) {
    return json({ ok: false, errorCode: 'not_found', status: upstream.status }, 404);
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');
  const headers = withCors({
    'content-type': contentType,
    'cache-control': 'public, max-age=1800'
  });
  if (contentLength) headers['content-length'] = contentLength;

  return new Response(upstream.body, {
    status: 200,
    headers
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: withCors() });
    }
    if (request.method !== 'GET') {
      return json({ ok: false, errorCode: 'method_not_allowed' }, 405);
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/api/aip-chart/resolve') {
      return handleResolve(requestUrl);
    }
    if (requestUrl.pathname === '/api/aip-chart/file') {
      return handleFile(requestUrl);
    }
    return json({ ok: false, errorCode: 'not_found' }, 404);
  }
};
