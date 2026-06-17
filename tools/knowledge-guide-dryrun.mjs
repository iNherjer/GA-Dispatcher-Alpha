#!/usr/bin/env node

const WIKI_API = 'https://de.wikipedia.org/w/api.php';
const USER_AGENT = 'GA-Dispatcher-KnowledgeGuideDryRun/0.1 (local dryrun)';

const DEFAULT_TARGETS = [
  { q: 'Nagoldtalsperre', cat: 'water_major', lat: 48.553, lon: 8.493 },
  { q: 'Kochertalbrücke', cat: 'bridge_major', lat: 49.162, lon: 9.785 },
  { q: 'Müngstener Brücke', cat: 'bridge_major', lat: 51.160, lon: 7.132 },
  { q: 'Göltzschtalbrücke', cat: 'bridge_major', lat: 50.623, lon: 12.242 },
  { q: 'Völkerschlachtdenkmal', cat: 'monument', lat: 51.3122, lon: 12.4131 },
  { q: 'Stuttgarter Fernsehturm', cat: 'tower_major', lat: 48.7558, lon: 9.1902 },
  { q: 'Kölner Dom', cat: 'religious_major', lat: 50.9413, lon: 6.9583 },
  { q: 'Speyerer Dom', cat: 'religious_major', lat: 49.3172, lon: 8.4422 },
  { q: 'Völklinger Hütte', cat: 'industry_major', lat: 49.249, lon: 6.845 },
  { q: 'Zeche Zollverein', cat: 'industry_major', lat: 51.486, lon: 7.045 },
  { q: 'Olympiastadion München', cat: 'stadium', lat: 48.173, lon: 11.546 },
  { q: 'Signal Iduna Park', cat: 'stadium', lat: 51.4926, lon: 7.4519 },
  { q: 'Rhein', cat: 'river_major', lat: 49.0, lon: 8.4 },
  { q: 'Bodensee', cat: 'lake_major', lat: 47.65, lon: 9.35 },
  { q: 'Pfalzgrafenweiler', cat: 'city', lat: 48.5283, lon: 8.5678 },
  { q: 'Durrweiler', cat: 'city', lat: 48.52029, lon: 8.54938 },
  { q: 'Rothenburg ob der Tauber', cat: 'city', lat: 49.378, lon: 10.179 },
  { q: 'Tagebau Hambach', cat: 'industry_major', lat: 50.91, lon: 6.50 },
  { q: 'Edertalsperre', cat: 'dam_major', lat: 51.184, lon: 9.059 },
  { q: 'Walhalla', cat: 'monument', lat: 49.031, lon: 12.224 }
];

const INFOBOX_KEY_PATTERNS = [
  /bauzeit/i,
  /erbaut|errichtet/i,
  /inbetrieb/i,
  /höhe|hoehe/i,
  /länge|laenge|kronenlänge|kronenlaenge|seelänge|seelaenge/i,
  /volumen|speicher|stauraum|stauvolumen/i,
  /fläche|flaeche/i,
  /kapazität|kapazitaet|zuschauer/i,
  /architekt/i,
  /betreiber|eigentümer|eigentuemer/i,
  /nutzung|zweck/i,
  /unesco/i,
  /zufluss|abfluss/i,
  /naherort|uferort|ort/i,
  /spannweite/i,
  /material|bauart|konstruktion/i
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const REQUEST_STATS = {
  requests: 0,
  rateLimited: 0,
  retryWaitMs: 0
};

function usage() {
  return [
    'Usage:',
    '  node tools/knowledge-guide-dryrun.mjs',
    '  node tools/knowledge-guide-dryrun.mjs --target "Name|category|lat|lon" --target "..."',
    '  node tools/knowledge-guide-dryrun.mjs --targets-file analysis/targets.json --json',
    '  node tools/knowledge-guide-dryrun.mjs --gate --target "Name|category|lat|lon" --target "..."',
    '',
    'Target JSON shape:',
    '  [{ "q": "Nagoldtalsperre", "cat": "water_major", "lat": 48.553, "lon": 8.493 }]',
    'Gate JSON shapes:',
    '  [{ "name": "Scenario", "candidates": [{ "q": "Kölner Dom", "cat": "religious_major", "lat": 50.9413, "lon": 6.9583 }] }]',
    '  { "groups": [{ "name": "Scenario", "candidates": [...] }] }',
    '',
    'Options:',
    '  --target "Name|category|lat|lon"   Add one target.',
    '  --targets-file FILE                Read targets from JSON file.',
    '  --gate                             Run the candidate gate: balanced shortlist, accept-only pick, fail-fast 429.',
    '  --gate-max-candidates N            Default: 3.',
    '  --gate-budget-ms N                 Default: 2500.',
    '  --json                             Print JSON only.',
    '  --jsonl                            Print one JSON object per target.',
    '  --accept-score N                   Default: 70.',
    '  --review-score N                   Default: 55.',
    '  --batch-size N                     Default: 1. Full extracts are most reliable one page at a time.',
    '  --delay-ms N                       Default: 1200.',
    '  --help                             Show this help.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    targets: [],
    targetsFile: '',
    gate: false,
    gateMaxCandidates: 3,
    gateBudgetMs: 2500,
    json: false,
    jsonl: false,
    acceptScore: 70,
    reviewScore: 55,
    batchSize: 1,
    delayMs: 1200
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--jsonl') {
      opts.jsonl = true;
    } else if (arg === '--target') {
      const value = argv[++i] || '';
      opts.targets.push(parseTargetString(value));
    } else if (arg === '--targets-file') {
      opts.targetsFile = argv[++i] || '';
    } else if (arg === '--gate') {
      opts.gate = true;
    } else if (arg === '--gate-max-candidates') {
      opts.gateMaxCandidates = Number(argv[++i] || opts.gateMaxCandidates);
    } else if (arg === '--gate-budget-ms') {
      opts.gateBudgetMs = Number(argv[++i] || opts.gateBudgetMs);
    } else if (arg === '--accept-score') {
      opts.acceptScore = Number(argv[++i] || opts.acceptScore);
    } else if (arg === '--review-score') {
      opts.reviewScore = Number(argv[++i] || opts.reviewScore);
    } else if (arg === '--batch-size') {
      opts.batchSize = Number(argv[++i] || opts.batchSize);
    } else if (arg === '--delay-ms') {
      opts.delayMs = Number(argv[++i] || opts.delayMs);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  opts.acceptScore = Number.isFinite(opts.acceptScore) ? opts.acceptScore : 70;
  opts.reviewScore = Number.isFinite(opts.reviewScore) ? opts.reviewScore : 55;
  opts.batchSize = Math.max(1, Math.min(25, Number.isFinite(opts.batchSize) ? Math.round(opts.batchSize) : 1));
  opts.delayMs = Math.max(0, Number.isFinite(opts.delayMs) ? Math.round(opts.delayMs) : 1200);
  opts.gateMaxCandidates = Math.max(1, Math.min(8, Number.isFinite(opts.gateMaxCandidates) ? Math.round(opts.gateMaxCandidates) : 3));
  opts.gateBudgetMs = Math.max(500, Math.min(15000, Number.isFinite(opts.gateBudgetMs) ? Math.round(opts.gateBudgetMs) : 2500));
  return opts;
}

function parseTargetString(value) {
  const parts = String(value || '').split('|').map(s => s.trim());
  if (parts.length < 4) {
    throw new Error(`Invalid --target value. Expected "Name|category|lat|lon": ${value}`);
  }
  return {
    q: parts[0],
    cat: parts[1] || 'generic',
    lat: Number(parts[2]),
    lon: Number(parts[3])
  };
}

async function loadTargets(opts) {
  if (opts.targetsFile) {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile(opts.targetsFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('--targets-file must contain a JSON array');
    opts.targets.push(...parsed);
  }
  const targets = opts.targets.length ? opts.targets : DEFAULT_TARGETS;
  return targets.map((target, index) => normalizeTarget(target, index));
}

async function loadGateGroups(opts) {
  const groups = [];
  if (opts.targets.length) {
    groups.push({ name: 'cli-targets', candidates: opts.targets });
  }
  if (opts.targetsFile) {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile(opts.targetsFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.some(item => Array.isArray(item?.candidates))) {
        for (const item of parsed) {
          if (Array.isArray(item?.candidates)) {
            groups.push({ name: String(item.name || item.id || `group-${groups.length + 1}`), candidates: item.candidates });
          }
        }
      } else {
        groups.push({ name: 'targets-file', candidates: parsed });
      }
    } else if (Array.isArray(parsed?.groups)) {
      for (const item of parsed.groups) {
        if (Array.isArray(item?.candidates)) {
          groups.push({ name: String(item.name || item.id || `group-${groups.length + 1}`), candidates: item.candidates });
        }
      }
    } else if (Array.isArray(parsed?.candidates)) {
      groups.push({ name: String(parsed.name || parsed.id || 'targets-file'), candidates: parsed.candidates });
    } else {
      throw new Error('--targets-file for --gate must contain targets, groups, or candidates');
    }
  }
  if (!groups.length) groups.push({ name: 'default-targets', candidates: DEFAULT_TARGETS });
  return groups.map((group, groupIndex) => ({
    name: String(group.name || `group-${groupIndex + 1}`),
    candidates: (Array.isArray(group.candidates) ? group.candidates : []).map((target, index) => normalizeTarget(target, index))
  })).filter(group => group.candidates.length);
}

function normalizeTarget(target, index = 0) {
  const q = String(target?.q || target?.name || target?.title || '').trim();
  if (!q) throw new Error(`Target ${index + 1} has no q/name/title`);
  const lat = Number(target?.lat);
  const lon = Number(target?.lon);
  return {
    q,
    cat: String(target?.cat || target?.category || 'generic').trim().toLowerCase() || 'generic',
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    rank: Number.isFinite(Number(target?.rank)) ? Number(target.rank) : (Number.isFinite(Number(target?.candidateRank)) ? Number(target.candidateRank) : 0),
    sourceIndex: Number.isFinite(Number(target?.sourceIndex)) ? Number(target.sourceIndex) : index,
    tags: target?.tags && typeof target.tags === 'object' ? { ...target.tags } : {}
  };
}

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function wikiRequest(params, { retries = 2, failFast429 = false } = {}) {
  const url = `${WIKI_API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    REQUEST_STATS.requests += 1;
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT
      },
      signal: AbortSignal.timeout(20000)
    });
    if (response.status === 429 && failFast429) {
      REQUEST_STATS.rateLimited += 1;
      return {
        httpError: 429,
        retryAfter: response.headers.get('retry-after') || null,
        url,
        failFast: true
      };
    }
    if (response.status === 429 && attempt < retries) {
      REQUEST_STATS.rateLimited += 1;
      const retryAfterSec = Number(response.headers.get('retry-after') || 0);
      const waitMs = Math.max(1500, retryAfterSec * 1000);
      REQUEST_STATS.retryWaitMs += waitMs;
      await sleep(waitMs);
      continue;
    }
    if (!response.ok) {
      return {
        httpError: response.status,
        retryAfter: response.headers.get('retry-after') || null,
        url
      };
    }
    return response.json();
  }
  return { httpError: 429, retryAfter: null, url };
}

async function fetchWikiBatch(targets, requestOptions = {}) {
  const titles = targets.map(t => t.q).join('|');
  const data = await wikiRequest({
    action: 'query',
    redirects: '1',
    prop: 'extracts|coordinates|pageprops|pageimages|info|categories',
    inprop: 'url',
    explaintext: '1',
    exchars: '6500',
    exlimit: 'max',
    exsectionformat: 'plain',
    cllimit: '30',
    piprop: 'thumbnail',
    pithumbsize: '600',
    titles
  }, requestOptions);
  if (data.httpError) return { error: data, pagesByRequestTitle: new Map(), redirectsByFrom: new Map() };

  const redirectsByFrom = new Map();
  for (const redirect of data?.query?.redirects || []) {
    redirectsByFrom.set(normalizeKey(redirect.from), String(redirect.to || '').trim());
  }

  const pages = Object.values(data?.query?.pages || {});
  const pagesByTitle = new Map();
  for (const page of pages) pagesByTitle.set(normalizeKey(page.title), page);

  const revisionTitles = pages.map(page => String(page.title || '').trim()).filter(Boolean);
  if (revisionTitles.length) {
    const revData = await wikiRequest({
      action: 'query',
      redirects: '1',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      rvsection: '0',
      titles: revisionTitles.join('|')
    }, requestOptions);
    if (!revData.httpError) {
      const revPages = Object.values(revData?.query?.pages || {});
      const revisionByTitle = new Map();
      for (const page of revPages) revisionByTitle.set(normalizeKey(page.title), revisionContent(page));
      for (const page of pages) {
        page._wikitext = revisionByTitle.get(normalizeKey(page.title)) || '';
      }
    }
  }

  const pagesByRequestTitle = new Map();
  for (const target of targets) {
    const redirectedTo = redirectsByFrom.get(normalizeKey(target.q));
    const page = pagesByTitle.get(normalizeKey(redirectedTo || target.q)) || null;
    pagesByRequestTitle.set(target.q, { page, redirectedTo: redirectedTo || null });
  }

  return { pagesByRequestTitle, redirectsByFrom, error: null };
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

function distanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const radiusKm = 6371;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(a));
}

function cleanWikiText(value) {
  return String(value || '')
    .replace(/\[\d+\]/g, '')
    .replace(/==+\s*[^=]+\s*==+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitFacts(text) {
  const cleaned = protectSentenceDots(cleanWikiText(text));
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/)
    .map(s => s.replaceAll('<DOT>', '.').trim())
    .map(s => s.replace(/^(Freizeit|Geografie|Geschichte|Technische Daten|Nutzung|Beschreibung|Bauwerk)\s+/i, '').trim())
    .filter(s => s.length >= 45)
    .filter(s => !/^(siehe auch|literatur|weblinks|einzelnachweise|normdaten)\b/i.test(s))
    .filter(s => !/\b(ISBN|Systemdruck|Verlag|Literatur|Weblinks|Einzelnachweise|Normdaten|Auflage|Hrsg\.)\b/i.test(s))
    .filter(s => !/^(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i.test(s))
    .filter(s => !/begriffsklärung|liste von|steht für|kann bedeuten/i.test(s));
}

function protectSentenceDots(text) {
  return String(text || '')
    .replace(/\b(\d{1,2})\.\s+(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/g, '$1<DOT> $2')
    .replace(/\b(St)\.\s+(?=[A-ZÄÖÜ])/g, '$1<DOT> ')
    .replace(/\b(z)\.\s*(B)\./gi, '$1<DOT> $2<DOT>');
}

function factTopics(sentence) {
  const text = String(sentence || '').toLowerCase();
  const topics = [];
  if (/\b(erbaut|gebaut|bauzeit|in betrieb|eröffnet|eroeffnet|errichtet|jahrhundert|gründ|gruend|stillgelegt|unesco|denkmal|geschichte|histor)/.test(text)) topics.push('history');
  if (/\b(liegt|lage|befindet|mündet|muendet|fluss|tal|region|landkreis|stadt|gemeinde|ufer|zufluss|abfluss|ortsteil)/.test(text)) topics.push('location');
  if (/\b(meter|kilometer|km|mio|million|höhe|hoehe|länge|laenge|fläche|flaeche|volumen|einwohner|kapazität|kapazitaet|spannweite|stau|kronen|speicher)/.test(text)) topics.push('metrics');
  if (/\b(dient|nutzung|versorgt|freizeit|tourismus|seg|surf|baden|rad|spazier|stadion|veranstaltung|museum|naherholung|aussichtsplattform)/.test(text)) topics.push('use');
  if (/\b(architekt|stil|bauwerk|kirche|dom|brücke|bruecke|turm|damm|anlage|industr|konstruktion|bogen|stahl|beton|mauer|viadukt)/.test(text)) topics.push('structure');
  if (/\b(natur|schutzgebiet|wald|landschaft|see|fluss|park|ökolog|oekolog|vogel|lebensraum|schwarzwald|ufer)/.test(text)) topics.push('nature');
  return topics.length ? [...new Set(topics)] : ['general'];
}

function pickFacts(text, infoboxFacts, maxFacts = 10) {
  const bodyFacts = splitFacts(text).map(sentence => ({
    source: 'extract',
    topic: factTopics(sentence)[0],
    topics: factTopics(sentence),
    text: sentence
  }));
  const boxFacts = infoboxFacts.map(item => ({
    source: 'infobox',
    topic: topicForInfoboxKey(item.key),
    topics: [topicForInfoboxKey(item.key)],
    text: `${item.key}: ${item.value}`
  }));
  const candidates = [...bodyFacts, ...boxFacts];
  const selected = [];
  const topicCount = new Map();
  const selectedKeys = new Set();

  for (const fact of candidates) {
    const topic = fact.topic || 'general';
    const current = topicCount.get(topic) || 0;
    if (current >= 2) continue;
    selected.push(fact);
    selectedKeys.add(fact.text);
    topicCount.set(topic, current + 1);
    if (selected.length >= maxFacts) break;
  }
  for (const fact of candidates) {
    if (selected.length >= maxFacts) break;
    if (selectedKeys.has(fact.text)) continue;
    selected.push(fact);
    selectedKeys.add(fact.text);
  }
  return {
    candidates,
    selected,
    topics: [...new Set(selected.flatMap(fact => fact.topics || [fact.topic || 'general']))].sort()
  };
}

function topicForInfoboxKey(key) {
  const text = String(key || '').toLowerCase();
  if (/bauzeit|erbaut|errichtet|inbetrieb/.test(text)) return 'history';
  if (/höhe|hoehe|länge|laenge|fläche|flaeche|volumen|speicher|stauraum|spannweite|kapazität|kapazitaet/.test(text)) return 'metrics';
  if (/zufluss|abfluss|naherort|uferort|ort/.test(text)) return 'location';
  if (/architekt|material|bauart|konstruktion/.test(text)) return 'structure';
  if (/nutzung|zweck|betreiber|eigentümer|eigentuemer/.test(text)) return 'use';
  return 'general';
}

function revisionContent(page) {
  if (page?._wikitext) return page._wikitext;
  const revision = page?.revisions?.[0] || null;
  return revision?.slots?.main?.['*'] || revision?.['*'] || '';
}

function parseInfoboxFacts(wikitext) {
  const lines = String(wikitext || '').split(/\r?\n/);
  const facts = [];
  let inBox = false;
  let depth = 0;
  for (const line of lines) {
    if (!inBox && /^\s*\{\{Infobox/i.test(line)) {
      inBox = true;
      depth = 1;
      continue;
    }
    if (!inBox) continue;
    depth += (line.match(/\{\{/g) || []).length;
    depth -= (line.match(/\}\}/g) || []).length;
    const match = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (match) {
      const key = cleanWikiMarkup(match[1]);
      const value = cleanWikiMarkup(match[2]);
      if (/^(breitengrad|laengengrad|längengrad|koordinaten?)$/i.test(key)) continue;
      if (key && value && INFOBOX_KEY_PATTERNS.some(pattern => pattern.test(key))) {
        facts.push({ key, value: value.slice(0, 180) });
      }
    }
    if (depth <= 0) break;
  }
  return facts;
}

function cleanWikiMarkup(value) {
  return String(value || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^/>]*\/>/g, '')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryProfile(cat) {
  const value = String(cat || '').toLowerCase();
  return {
    raw: value,
    isLinear: /river|fluss|canal|lake|see|water|river_major|lake_major/.test(value),
    isCity: /city|town|village|settlement|ort/.test(value),
    isTechnical: /bridge|dam|tower|industry|stadium|religious|monument/.test(value),
    isCompactInfrastructure: /bridge|dam|tower/.test(value),
    isSupportedKnowledgeType: /city|town|village|settlement|ort|castle|historic|water|lake|river|canal|bridge|dam|tower|industry|stadium|religious|monument|nature/.test(value)
  };
}

function scoreKnowledge({ target, page, redirectedTo, facts, infoboxFacts }) {
  const reasons = [];
  const warnings = [];
  const profile = categoryProfile(target.cat);
  const extract = String(page?.extract || '').trim();
  const title = String(page?.title || '').trim();
  const qid = String(page?.pageprops?.wikibase_item || '').trim();
  const thumb = page?.thumbnail?.source || '';
  const coordinate = page?.coordinates?.[0] || null;
  const dist = coordinate && target.lat !== null && target.lon !== null
    ? distanceKm(target.lat, target.lon, Number(coordinate.lat), Number(coordinate.lon))
    : null;
  const exactTitle = normalizeKey(title).includes(normalizeKey(target.q))
    || normalizeKey(target.q).includes(normalizeKey(title));
  const distinctTopics = facts.topics.length;
  let score = 0;

  if (extract.length >= 2200) { score += 32; reasons.push('long_extract'); }
  else if (extract.length >= 1200) { score += 26; reasons.push('solid_extract'); }
  else if (extract.length >= 650) { score += 18; reasons.push('medium_extract'); }
  else if (extract.length >= 350) { score += 10; reasons.push('short_but_usable_extract'); }
  else warnings.push('thin_extract');

  if (facts.candidates.length >= 12) { score += 30; reasons.push('many_fact_candidates'); }
  else if (facts.candidates.length >= 8) { score += 24; reasons.push('good_fact_count'); }
  else if (facts.candidates.length >= 6) { score += 18; reasons.push('acceptable_fact_count'); }
  else if (facts.candidates.length >= 4) { score += 10; reasons.push('low_fact_count'); }
  else warnings.push('too_few_facts');

  if (facts.selected.length >= 6) { score += 10; reasons.push('enough_voice_facts'); }
  if (distinctTopics >= 4) { score += 12; reasons.push('topic_diversity'); }
  else if (distinctTopics >= 3) score += 8;
  else if (distinctTopics >= 2) score += 4;
  else warnings.push('low_topic_diversity');

  if (qid) { score += 10; reasons.push('wikidata_qid'); }
  if (thumb) { score += 5; reasons.push('page_image'); }
  if (exactTitle) { score += 12; reasons.push('title_match'); }
  if (redirectedTo) {
    reasons.push('redirect_resolved');
    if (!exactTitle && profile.isCity) warnings.push('city_redirect_or_parent_context');
  }

  if (Number.isFinite(dist)) {
    if (profile.isLinear) {
      if (dist < 80) score += 6;
      else warnings.push('linear_feature_coordinate_far_from_target');
    } else if (dist < 1) {
      score += 15;
      reasons.push('coordinate_close');
    } else if (dist < 5) {
      score += 10;
      reasons.push('coordinate_near');
    } else if (dist < 12) {
      score += 3;
      warnings.push('coordinate_loose');
    } else {
      score -= 14;
      warnings.push('coordinate_far');
    }
  } else if (exactTitle && profile.isTechnical) {
    score += 3;
    warnings.push('no_page_coordinate_but_exact_title');
  } else {
    warnings.push('no_page_coordinate');
  }

  if (infoboxFacts.length >= 8) {
    score += 14;
    reasons.push('rich_infobox');
  } else if (infoboxFacts.length >= 4) {
    score += 9;
    reasons.push('useful_infobox');
  } else if (infoboxFacts.length >= 1) {
    score += 4;
    reasons.push('small_infobox');
  }

  const compactInfra = profile.isCompactInfrastructure
    && facts.candidates.length >= 4
    && /\b(höchste|hoe?chste|größte|groesste|längste|laengste|meter|mio|million|bauzeit|erbaut|in betrieb|kronen|spannweite)\b/i.test(extract);
  if (compactInfra) {
    score += 12;
    reasons.push('compact_infrastructure_bonus');
  }

  let status = 'reject';
  if (score >= globalThis.__acceptScore) status = 'accept';
  else if (score >= globalThis.__reviewScore) status = 'review';

  if (status === 'accept' && profile.isCity && !exactTitle) {
    status = 'review';
    warnings.push('city_target_shift_requires_review');
  }
  if (!profile.isSupportedKnowledgeType) {
    status = score >= globalThis.__reviewScore ? 'review' : 'reject';
    warnings.push('unsupported_knowledge_category');
  }
  if (status === 'accept' && profile.isLinear && isGenericLinearTitle(title)) {
    status = 'reject';
    warnings.push('generic_linear_article_title');
  }
  if (status === 'accept' && profile.isLinear && !Number.isFinite(dist) && !hasLinearWaterEvidence(extract, infoboxFacts)) {
    status = 'review';
    warnings.push('linear_target_without_coordinate_or_water_evidence');
  }
  if (status === 'accept' && facts.selected.length < 5) {
    status = 'review';
    warnings.push('too_few_selected_voice_facts_for_auto_accept');
  }

  return {
    score,
    status,
    reasons,
    warnings,
    exactTitle,
    distanceKm: Number.isFinite(dist) ? Number(dist.toFixed(2)) : null,
    coordinate: coordinate ? { lat: Number(coordinate.lat), lon: Number(coordinate.lon) } : null
  };
}

function isGenericLinearTitle(title) {
  const key = normalizeKey(title);
  return [
    'bach',
    'weiher',
    'teich',
    'see',
    'fluss',
    'kanal',
    'graben',
    'quelle',
    'reservoir',
    'stausee'
  ].includes(key);
}

function hasLinearWaterEvidence(extract, infoboxFacts = []) {
  const text = normalizeKey([
    extract,
    ...infoboxFacts.map(item => `${item.key} ${item.value}`)
  ].join(' '));
  return /fluss|strom|see|stausee|talsperre|gewaesser|gewasser|zufluss|abfluss|quelle|muendung|mundung|laenge|lange|seelaenge|speicherraum|uferort|einzugsgebiet/.test(text);
}

const GATE_BUCKET_PRIORITY = [
  'city',
  'water',
  'dam',
  'bridge',
  'tower',
  'monument',
  'religious',
  'stadium',
  'industry',
  'castle',
  'mountain',
  'nature'
];

function knowledgeGateBucket(target) {
  const cat = String(target?.cat || '').toLowerCase();
  const name = String(target?.q || '').toLowerCase();
  const tags = target?.tags && typeof target.tags === 'object' ? target.tags : {};
  const tagText = Object.entries(tags)
    .map(([key, value]) => `${key}:${value}`)
    .join(' ')
    .toLowerCase();
  const hay = `${cat} ${name} ${tagText}`;
  const placeHay = `${cat} ${tagText}`;
  const hasPlaceSignal = /city|town|village|settlement|place:city|place:town|place:village/.test(placeHay);
  const normName = normalizeKey(name);

  if (/dam|talsperre|staudamm|stausee|sperrmauer|waterway:dam|waterway:weir/.test(hay)) return 'dam';
  if (/bridge|bruecke|brücke|viadukt|man_made:bridge/.test(hay)) return 'bridge';
  if (/tower|turm|telecom|fernsehturm|funkturm|aussichtsturm|man_made:tower|man_made:mast/.test(hay)) return 'tower';
  if (/religious|church|kirche|dom|kathedrale|muenster|münster|amenity:place_of_worship/.test(hay)) return 'religious';
  if (/stadium|stadion|arena|leisure:stadium/.test(hay)) return 'stadium';
  if (/industry|industrial|industrie|werk|huette|hütte|zeche|tagebau|kraftwerk|fabrik|landuse:industrial|man_made:works|power:plant/.test(hay)) return 'industry';
  if (/monument|denkmal|memorial|walhalla|historic:monument|historic:memorial/.test(hay)) return 'monument';
  if (/castle|burg|schloss|fortress|ruine|ruins|historic:castle|historic:ruins/.test(hay)) return 'castle';
  if (
    /river|fluss|lake|canal|water|reservoir|natural:water|water:reservoir|water:lake|landuse:reservoir/.test(hay) ||
    /\b(see|teich|weiher)\b/.test(name) ||
    /see$/.test(normName)
  ) return 'water';
  if (hasPlaceSignal) return 'city';
  if (/mountain|berg|gipfel|peak|valley|tal|ridge|natural:peak|natural:valley/.test(hay)) return 'mountain';
  if (/nature|park|wald|forest|schutzgebiet|natural:wood|landuse:forest/.test(hay)) return 'nature';
  if (/city|town|village|settlement|ort|place:city|place:town|place:village/.test(hay)) return 'city';
  return 'generic';
}

function knowledgeGateBadNameReason(target) {
  const raw = String(target?.q || '').trim();
  if (!raw) return 'missing_name';
  const compact = raw.replace(/\s+/g, '');
  const key = normalizeKey(raw);
  const genericNames = new Set([
    'poi',
    'zielgebiet',
    'gewaesser',
    'gewasser',
    'stadtgebiet',
    'berggebiet',
    'talgebiet',
    'infrastruktur',
    'infrastrukturkorridor',
    'strassenverkehrsknoten',
    'brueckeverkehrsbauwerk',
    'funkmastfunkturmwindrad',
    'staudammtalsperre'
  ]);
  if (genericNames.has(key)) return 'generic_name';
  if (isGenericLinearTitle(raw)) return 'generic_linear_name';
  if (/^[0-9]+([a-z])?$/i.test(compact)) return 'numeric_name';
  if (/^[A-Z]?\s*\d{1,5}(?:[\/.-]\d{1,5})?$/i.test(raw)) return 'code_like_name';
  if (/^\d{1,4}\s*[A-Z]\d{0,3}$/i.test(raw)) return 'code_like_name';
  if (/^[A-Z]{1,3}\s*\d{1,4}$/i.test(raw)) return 'code_like_name';
  if (raw.includes(' / ')) return 'junction_label';
  return '';
}

function buildKnowledgeGateShortlist(candidates, opts) {
  const maxCandidates = Math.max(1, Math.min(8, Number(opts.gateMaxCandidates || 3)));
  const prepared = candidates.map((candidate, index) => {
    const bucket = knowledgeGateBucket(candidate);
    const badNameReason = knowledgeGateBadNameReason(candidate);
    const supported = GATE_BUCKET_PRIORITY.includes(bucket);
    return {
      ...candidate,
      sourceIndex: Number.isFinite(Number(candidate.sourceIndex)) ? Number(candidate.sourceIndex) : index,
      bucket,
      gateRejectedReason: badNameReason || (!supported ? 'unsupported_bucket' : '')
    };
  });
  const eligible = prepared.filter(candidate => !candidate.gateRejectedReason);
  const byBucket = new Map();
  for (const candidate of eligible) {
    if (!byBucket.has(candidate.bucket)) byBucket.set(candidate.bucket, []);
    byBucket.get(candidate.bucket).push(candidate);
  }
  for (const list of byBucket.values()) {
    list.sort((a, b) => (
      Number(b.rank || 0) - Number(a.rank || 0)
    ) || (
      Number(a.sourceIndex || 0) - Number(b.sourceIndex || 0)
    ) || String(a.q || '').localeCompare(String(b.q || ''), 'de'));
  }
  const bucketOrder = [
    ...GATE_BUCKET_PRIORITY.filter(bucket => byBucket.has(bucket)),
    ...[...byBucket.keys()].filter(bucket => !GATE_BUCKET_PRIORITY.includes(bucket)).sort()
  ];
  const shortlist = [];
  const seen = new Set();
  for (let round = 0; shortlist.length < maxCandidates; round += 1) {
    let added = false;
    for (const bucket of bucketOrder) {
      const candidate = byBucket.get(bucket)?.[round] || null;
      if (!candidate) continue;
      const key = `${normalizeKey(candidate.q)}|${candidate.bucket}`;
      if (seen.has(key)) continue;
      seen.add(key);
      shortlist.push(candidate);
      added = true;
      if (shortlist.length >= maxCandidates) break;
    }
    if (!added) break;
  }
  return { prepared, shortlist };
}

async function runKnowledgeGateGroup(group, opts) {
  const started = Date.now();
  const gate = buildKnowledgeGateShortlist(group.candidates, opts);
  const evaluated = [];
  let finalStatus = 'no_pick';
  let pick = null;
  let stopReason = '';

  for (const candidate of gate.shortlist) {
    if ((Date.now() - started) >= opts.gateBudgetMs) {
      stopReason = 'budget_exhausted_before_candidate';
      break;
    }
    const data = await fetchWikiBatch([candidate], { retries: 0, failFast429: true });
    if (data.error) {
      const errorResult = summarizeTarget(candidate, { error: data.error }, opts);
      errorResult.bucket = candidate.bucket;
      evaluated.push(errorResult);
      if (Number(data.error.httpError || 0) === 429) {
        finalStatus = 'rate_limited';
        stopReason = 'wiki_429_fail_fast';
        break;
      }
      continue;
    }
    const pageInfo = data.pagesByRequestTitle.get(candidate.q) || { page: null, redirectedTo: null };
    const result = summarizeTarget(candidate, pageInfo, opts);
    result.bucket = candidate.bucket;
    evaluated.push(result);
    if (result.status === 'accept') {
      finalStatus = 'accept';
      pick = result;
      stopReason = 'accepted';
      break;
    }
    if ((Date.now() - started) >= opts.gateBudgetMs) {
      stopReason = 'budget_exhausted_after_candidate';
      break;
    }
  }

  if (!stopReason) stopReason = gate.shortlist.length ? 'no_accept_in_shortlist' : 'no_supported_candidates';
  return {
    group: group.name,
    status: finalStatus,
    stopReason,
    elapsedMs: Date.now() - started,
    budgetMs: opts.gateBudgetMs,
    maxCandidates: opts.gateMaxCandidates,
    poolSize: group.candidates.length,
    eligibleCount: gate.prepared.filter(item => !item.gateRejectedReason).length,
    rejectedCandidates: gate.prepared
      .filter(item => item.gateRejectedReason)
      .map(item => ({ query: item.q, category: item.cat, bucket: item.bucket, reason: item.gateRejectedReason })),
    shortlist: gate.shortlist.map(item => ({ query: item.q, category: item.cat, bucket: item.bucket, rank: item.rank })),
    evaluated,
    pick
  };
}

function summarizeTarget(target, pageInfo, opts) {
  if (pageInfo.error) {
    return {
      query: target.q,
      category: target.cat,
      status: 'error',
      error: pageInfo.error.httpError || pageInfo.error,
      retryAfter: pageInfo.error.retryAfter || null
    };
  }
  const page = pageInfo.page;
  if (!page || page.missing !== undefined) {
    return {
      query: target.q,
      category: target.cat,
      status: 'reject',
      score: 0,
      title: null,
      reasons: [],
      warnings: ['missing_wikipedia_page']
    };
  }
  const infoboxFacts = parseInfoboxFacts(revisionContent(page));
  const facts = pickFacts(page.extract || '', infoboxFacts, 10);
  const scored = scoreKnowledge({
    target,
    page,
    redirectedTo: pageInfo.redirectedTo,
    facts,
    infoboxFacts
  });
  return {
    query: target.q,
    category: target.cat,
    status: scored.status,
    score: scored.score,
    title: String(page.title || ''),
    redirectedTo: pageInfo.redirectedTo,
    qid: page.pageprops?.wikibase_item || null,
    pageUrl: page.fullurl || null,
    chars: String(page.extract || '').trim().length,
    factCandidates: facts.candidates.length,
    selectedFacts: facts.selected.length,
    topics: facts.topics,
    image: !!page.thumbnail?.source,
    exactTitle: scored.exactTitle,
    distanceKm: scored.distanceKm,
    coordinate: scored.coordinate,
    infoboxFacts: infoboxFacts.length,
    infoboxSample: infoboxFacts.slice(0, opts.json ? 12 : 6),
    reasons: scored.reasons,
    warnings: scored.warnings,
    sampleFacts: facts.selected.slice(0, opts.json ? 10 : 5).map(fact => ({
      source: fact.source,
      topic: fact.topic,
      text: fact.text.length > 220 ? `${fact.text.slice(0, 217)}...` : fact.text
    }))
  };
}

function printReport(results, opts) {
  if (opts.json) {
    console.log(JSON.stringify({ stats: REQUEST_STATS, results }, null, 2));
    return;
  }
  if (opts.jsonl) {
    for (const result of results) console.log(JSON.stringify(result));
    return;
  }
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`Knowledge Guide Wiki dryrun: ${results.length} targets`);
  console.log(`accept=${counts.accept || 0} review=${counts.review || 0} reject=${counts.reject || 0} error=${counts.error || 0}`);
  console.log(`requests=${REQUEST_STATS.requests} rateLimited=${REQUEST_STATS.rateLimited} retryWaitMs=${REQUEST_STATS.retryWaitMs}`);
  console.log('');
  for (const result of results) {
    const label = `${result.status.toUpperCase().padEnd(6)} ${String(result.score ?? '-').toString().padStart(3)} ${result.query}`;
    console.log(label);
    console.log(`  title=${result.title || '-'} cat=${result.category} qid=${result.qid || '-'} distKm=${result.distanceKm ?? '-'} chars=${result.chars ?? 0} facts=${result.selectedFacts ?? 0}/${result.factCandidates ?? 0} infobox=${result.infoboxFacts ?? 0}`);
    if (result.redirectedTo) console.log(`  redirect=${result.redirectedTo}`);
    if (result.reasons?.length) console.log(`  reasons=${result.reasons.join(', ')}`);
    if (result.warnings?.length) console.log(`  warnings=${result.warnings.join(', ')}`);
    for (const fact of result.sampleFacts || []) {
      console.log(`  - [${fact.source}/${fact.topic}] ${fact.text}`);
    }
    if (result.infoboxSample?.length) {
      const box = result.infoboxSample.map(item => `${item.key}: ${item.value}`).join(' | ');
      console.log(`  infobox: ${box}`);
    }
    console.log('');
  }
}

function printGateReport(results, opts) {
  if (opts.json) {
    console.log(JSON.stringify({ stats: REQUEST_STATS, gates: results }, null, 2));
    return;
  }
  if (opts.jsonl) {
    for (const result of results) console.log(JSON.stringify(result));
    return;
  }
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`Knowledge Guide candidate gate dryrun: ${results.length} groups`);
  console.log(`accept=${counts.accept || 0} no_pick=${counts.no_pick || 0} rate_limited=${counts.rate_limited || 0}`);
  console.log(`requests=${REQUEST_STATS.requests} rateLimited=${REQUEST_STATS.rateLimited} retryWaitMs=${REQUEST_STATS.retryWaitMs}`);
  console.log('');
  for (const result of results) {
    console.log(`${result.status.toUpperCase().padEnd(12)} ${result.group} (${result.elapsedMs}ms, ${result.eligibleCount}/${result.poolSize} eligible)`);
    console.log(`  stop=${result.stopReason} budget=${result.budgetMs}ms maxCandidates=${result.maxCandidates}`);
    if (result.rejectedCandidates.length) {
      const rejected = result.rejectedCandidates
        .slice(0, 8)
        .map(item => `${item.query} [${item.category}/${item.bucket}:${item.reason}]`)
        .join(' | ');
      console.log(`  rejected=${rejected}`);
    }
    if (result.shortlist.length) {
      const shortlist = result.shortlist
        .map(item => `${item.query} [${item.category}/${item.bucket}]`)
        .join(' -> ');
      console.log(`  shortlist=${shortlist}`);
    }
    for (const item of result.evaluated) {
      console.log(`  ${item.status.toUpperCase().padEnd(6)} ${String(item.score ?? '-').toString().padStart(3)} ${item.query} -> ${item.title || '-'} bucket=${item.bucket || '-'}`);
      if (item.warnings?.length) console.log(`    warnings=${item.warnings.join(', ')}`);
    }
    if (result.pick) {
      console.log(`  PICK ${result.pick.title || result.pick.query} score=${result.pick.score} facts=${result.pick.selectedFacts}/${result.pick.factCandidates}`);
    }
    console.log('');
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }
  globalThis.__acceptScore = opts.acceptScore;
  globalThis.__reviewScore = opts.reviewScore;

  if (opts.gate) {
    const groups = await loadGateGroups(opts);
    const results = [];
    for (const group of groups) {
      results.push(await runKnowledgeGateGroup(group, opts));
      if (opts.delayMs > 0) await sleep(opts.delayMs);
    }
    printGateReport(results, opts);
    return;
  }

  const targets = await loadTargets(opts);
  const results = [];
  for (const batch of chunks(targets, opts.batchSize)) {
    const data = await fetchWikiBatch(batch);
    if (data.error) {
      for (const target of batch) results.push(summarizeTarget(target, { error: data.error }, opts));
    } else {
      for (const target of batch) {
        const pageInfo = data.pagesByRequestTitle.get(target.q) || { page: null, redirectedTo: null };
        results.push(summarizeTarget(target, pageInfo, opts));
      }
    }
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }
  printReport(results, opts);
}

main().catch(error => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
