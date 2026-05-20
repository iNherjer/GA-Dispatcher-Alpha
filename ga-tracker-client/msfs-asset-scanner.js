const fs = require('fs');
const path = require('path');
const os = require('os');

const TOOL_VERSION = 'v2';
const OUT_BASENAME = 'msfs2024-simobjects';
const DEFAULT_OUTPUT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

function argValue(names) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i];
    const eq = raw.indexOf('=');
    const key = eq >= 0 ? raw.slice(0, eq) : raw;
    const val = eq >= 0 ? raw.slice(eq + 1) : args[i + 1] || '';
    if (names.includes(key)) return val.replace(/^"|"$/g, '');
  }
  return '';
}

function hasArg(names) {
  return process.argv.slice(2).some((raw) => {
    const key = raw.includes('=') ? raw.slice(0, raw.indexOf('=')) : raw;
    return names.includes(key);
  });
}

function splitRootList(value) {
  return String(value || '')
    .split(/[;|]/)
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const s = String(value || '').trim();
    const key = s.toLowerCase();
    if (s && !seen.has(key)) {
      out.push(s);
      seen.add(key);
    }
  }
  return out;
}

function existsDir(p) {
  try { return p && fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

function existsFile(p) {
  try { return p && fs.statSync(p).isFile(); } catch (_) { return false; }
}

function readTextSafe(p) {
  try { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); } catch (_) { return ''; }
}

function readJsonSafe(p) {
  try { return JSON.parse(readTextSafe(p)); } catch (_) { return null; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function candidateUserCfgFiles() {
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [];

  if (appData) {
    candidates.push(path.join(appData, 'Microsoft Flight Simulator 2024', 'UserCfg.opt'));
    candidates.push(path.join(appData, 'Microsoft Flight Simulator', 'UserCfg.opt'));
  }

  if (localAppData) {
    const packagesDir = path.join(localAppData, 'Packages');
    try {
      for (const name of fs.readdirSync(packagesDir)) {
        if (/Microsoft\.(Limitless|FlightSimulator)/i.test(name)) {
          candidates.push(path.join(packagesDir, name, 'LocalCache', 'UserCfg.opt'));
        }
      }
    } catch (_) {}
  }

  return unique(candidates);
}

function parseInstalledPackagesPath(userCfgPath) {
  const text = readTextSafe(userCfgPath);
  const m = text.match(/InstalledPackagesPath\s+"([^"]+)"/i);
  return m ? m[1] : '';
}

function candidatePackageRoots() {
  const manual = splitRootList(argValue(['--packages', '--packagesPath', '--root']));
  const envRoot = splitRootList(process.env.MSFS2024_PACKAGES || '');
  const roots = [...manual, ...envRoot];

  for (const cfg of candidateUserCfgFiles()) {
    if (existsFile(cfg)) roots.push(parseInstalledPackagesPath(cfg));
  }

  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  if (appData) {
    roots.push(path.join(appData, 'Microsoft Flight Simulator 2024', 'Packages'));
    roots.push(path.join(appData, 'Microsoft Flight Simulator', 'Packages'));
  }

  if (localAppData) {
    const packagesDir = path.join(localAppData, 'Packages');
    try {
      for (const name of fs.readdirSync(packagesDir)) {
        if (/Microsoft\.(Limitless|FlightSimulator)/i.test(name)) {
          roots.push(path.join(packagesDir, name, 'LocalCache', 'Packages'));
        }
      }
    } catch (_) {}
  }

  return unique(roots).filter(existsDir);
}

function hasDirectPackageChildren(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }).slice(0, 500); } catch (_) { return false; }
  return entries.some((entry) => {
    if (!entry.isDirectory()) return false;
    const full = path.join(dir, entry.name);
    return existsDir(path.join(full, 'SimObjects')) || existsFile(path.join(full, 'manifest.json')) || existsFile(path.join(full, 'layout.json'));
  });
}

function looksLikePackageDir(dir) {
  return existsDir(path.join(dir, 'SimObjects')) || existsFile(path.join(dir, 'manifest.json')) || existsFile(path.join(dir, 'layout.json'));
}

function sourceDirsForRoot(root) {
  const out = [];
  const seen = new Set();
  const add = (source, dir) => {
    if (!existsDir(dir)) return;
    const key = path.resolve(dir).toLowerCase();
    if (seen.has(key)) return;
    out.push({ source, dir });
    seen.add(key);
  };

  const addOfficialGroup = (label, dir) => {
    if (!existsDir(dir)) return;
    const leaves = [
      { label: `${label}/OneStore`, dir: path.join(dir, 'OneStore') },
      { label: `${label}/Steam`, dir: path.join(dir, 'Steam') }
    ].filter((entry) => existsDir(entry.dir));
    for (const leaf of leaves) add(leaf.label, leaf.dir);
    if (leaves.length === 0 || hasDirectPackageChildren(dir)) add(label, dir);
  };

  const base = path.basename(root).toLowerCase();
  if (/^(official|official2020|official2024)$/i.test(base)) {
    addOfficialGroup(path.basename(root), root);
  } else if (/^(community|community2024|onestore|steam|streamedpackages)$/i.test(base)) {
    add(path.basename(root), root);
  }

  addOfficialGroup('Official2024', path.join(root, 'Official2024'));
  add('StreamedPackages', path.join(root, 'StreamedPackages'));
  add('Community2024', path.join(root, 'Community2024'));
  addOfficialGroup('Official', path.join(root, 'Official'));
  add('Community', path.join(root, 'Community'));
  addOfficialGroup('Official2020', path.join(root, 'Official2020'));

  if (out.length === 0 && (looksLikePackageDir(root) || hasDirectPackageChildren(root))) {
    add(path.basename(root) || 'PackageRoot', root);
  }

  return out;
}

function skipDirectory(name) {
  return /^(html_ui|html-ui|sound|soundai|texture|textures|effects|materiallib|contentinfo|documentation|manuals|scenery)$/i.test(name);
}

function findSimObjectsDirs(sourceDir) {
  const out = [];
  const stack = [sourceDir];
  const seen = new Set();

  while (stack.length) {
    const dir = stack.pop();
    const key = path.resolve(dir).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (/^SimObjects$/i.test(entry.name)) {
        out.push(full);
        continue;
      }
      if (skipDirectory(entry.name)) continue;
      stack.push(full);
    }
  }

  return out;
}

function walkCfgFiles(sourceDir) {
  const out = [];
  const simObjectsDirs = findSimObjectsDirs(sourceDir);
  for (const simObjectsDir of simObjectsDirs) {
    const stack = [simObjectsDir];
    while (stack.length) {
      const dir = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skipDirectory(entry.name)) stack.push(full);
        } else if (/^(sim|aircraft)\.cfg$/i.test(entry.name)) {
          out.push(full);
        }
      }
    }
  }
  return out;
}

function stripInlineComment(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === ';') return line.slice(0, i);
    if (!quoted && ch === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

function parseCfg(text) {
  const sections = {};
  let current = 'global';
  sections[current] = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (!line) continue;
    const sec = line.match(/^\[([^\]]+)\]$/);
    if (sec) {
      current = sec[1].trim();
      if (!sections[current]) sections[current] = {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^"|"$/g, '');
    sections[current][key] = value;
  }
  return sections;
}

function dataValue(data, key) {
  const wantedKey = String(key || '').toLowerCase();
  for (const [k, v] of Object.entries(data || {})) {
    if (k.toLowerCase() === wantedKey) return String(v || '').trim();
  }
  return '';
}

function sectionValue(sections, sectionName, key) {
  const wanted = String(sectionName || '').toLowerCase();
  for (const [section, data] of Object.entries(sections)) {
    if (section.toLowerCase() !== wanted) continue;
    return dataValue(data, key);
  }
  return '';
}

function titleSections(sections) {
  const out = [];
  for (const [section, data] of Object.entries(sections)) {
    const title = dataValue(data, 'title');
    if (title) out.push({ section, title, data });
  }
  return out;
}

function simObjectKind(cfgPath) {
  const parts = cfgPath.split(path.sep);
  const idx = parts.findIndex((p) => p.toLowerCase() === 'simobjects');
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
}

function findPackageRoot(cfgPath, sourceDir) {
  const sourceResolved = path.resolve(sourceDir).toLowerCase();
  let dir = path.dirname(cfgPath);
  while (dir && path.resolve(dir).toLowerCase().startsWith(sourceResolved)) {
    if (existsFile(path.join(dir, 'manifest.json')) || existsFile(path.join(dir, 'layout.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const rel = path.relative(sourceDir, cfgPath).split(path.sep).filter(Boolean);
  return rel.length ? path.join(sourceDir, rel[0]) : sourceDir;
}

const manifestCache = new Map();
function packageMetadata(packageRoot) {
  const key = path.resolve(packageRoot).toLowerCase();
  if (manifestCache.has(key)) return manifestCache.get(key);

  const manifest = readJsonSafe(path.join(packageRoot, 'manifest.json')) || {};
  const meta = {
    name: path.basename(packageRoot),
    title: manifest.title || manifest.name || '',
    creator: manifest.creator || '',
    packageVersion: manifest.package_version || manifest.version || '',
    minimumGameVersion: manifest.minimum_game_version || '',
    contentType: manifest.content_type || ''
  };
  manifestCache.set(key, meta);
  return meta;
}

function makeTitleAliases(title, data) {
  const aliases = [title];
  const noVariant = String(title || '').replace(/\s+\([^)]*\)\s*$/g, '').trim();
  if (noVariant && noVariant !== title) aliases.push(noVariant);
  for (const key of ['ui_type', 'ui_variation', 'ui_createdby']) {
    const value = dataValue(data, key);
    if (value) aliases.push(value);
  }
  return unique(aliases);
}

function inferTags(record) {
  const hay = `${record.title} ${record.displayName} ${record.category} ${record.objectClass} ${record.kind} ${record.packageName} ${record.path}`.toLowerCase();
  const tags = [];
  const add = (tag, re) => { if (re.test(hay)) tags.push(tag); };
  add('fire', /(fire|firefight|feuer|brand|bush)/);
  add('smoke', /(smoke|rauch|chimney|vfx_smoke)/);
  add('sar', /(sar|rescue|search|rettung|lifeguard|mountain rescue)/);
  add('medical', /(medical|ambulance|medic|doctor|hospital|paramedic)/);
  add('police', /(police|law|security|sheriff)/);
  add('person', /(human|person|people|tarmac|termac|marshall|marshaller|character|female|male|pilot|worker|passenger|pax|crew)/);
  add('vehicle', /(vehicle|car|truck|bus|van|groundvehicle|tractor|fuel|pushback|follow|firefighting|pickup|ambulance|police)/);
  add('boat', /(boat|ship|vessel|ferry|tug|sail|yacht|watercraft)/);
  add('animal', /(animal|cow|horse|sheep|bird|whale|deer|bear|elephant|giraffe|kangaroo)/);
  add('airport', /(airport|tarmac|termac|marshaller|baggage|fuel|pushback|stairs|catering|ramp|jetway|ground)/);
  add('cargo', /(cargo|container|crate|box|freight|pallet|parcel|luggage|baggage|coffee|cup)/);
  add('construction', /(construction|crane|worker|dozer|excavator|tool|generator)/);
  add('marker', /(cone|windsock|marker|barrier|sign)/);
  add('vip', /(vip|limousine|limo|executive|security|escort)/);
  add('accident', /(wreck|crash|accident|debris|broken|emergency)/);
  return unique(tags);
}

function sceneRole(record) {
  const tags = record.tags || [];
  if (tags.includes('smoke')) return 'smoke';
  if (tags.includes('fire')) return 'fire';
  if (tags.includes('person')) return 'person';
  if (tags.includes('vehicle')) return 'vehicle';
  if (tags.includes('boat')) return 'boat';
  if (tags.includes('cargo')) return 'cargo';
  if (tags.includes('marker')) return 'marker';
  if (tags.includes('animal')) return 'animal';
  return 'other';
}

function scanSource(source) {
  const records = [];
  const cfgFiles = walkCfgFiles(source.dir);

  for (const cfgPath of cfgFiles) {
    const text = readTextSafe(cfgPath);
    const sections = parseCfg(text);
    const titles = titleSections(sections);
    const category = sectionValue(sections, 'General', 'category');
    const objectClass = sectionValue(sections, 'General', 'object_class');
    const kind = simObjectKind(cfgPath);
    const packageRoot = findPackageRoot(cfgPath, source.dir);
    const meta = packageMetadata(packageRoot);
    const relPath = path.relative(source.dir, cfgPath);
    const aircraftLike = /(airplane|aircraft|helicopter|rotorcraft)/i.test(`${kind} ${category} ${objectClass}`);

    const baseRecord = {
      source: source.source,
      sourceDir: source.dir,
      packageName: meta.name,
      packageTitle: meta.title,
      packageCreator: meta.creator,
      packageVersion: meta.packageVersion,
      packageContentType: meta.contentType,
      kind,
      category,
      objectClass,
      cfg: path.basename(cfgPath),
      path: relPath,
      absolutePath: cfgPath,
      packageRoot
    };

    if (titles.length) {
      for (const item of titles) {
        const uiType = dataValue(item.data, 'ui_type') || dataValue(item.data, 'ui_createdby');
        const uiVariation = dataValue(item.data, 'ui_variation');
        const model = dataValue(item.data, 'model') || sectionValue(sections, 'model', 'normal');
        const record = {
          ...baseRecord,
          title: item.title,
          displayName: uiVariation && !item.title.includes(uiVariation) ? `${item.title} (${uiVariation})` : item.title,
          aliases: makeTitleAliases(item.title, item.data),
          titleSource: item.section,
          uiType,
          uiVariation,
          model,
          spawnCandidate: true,
          sceneCandidate: !aircraftLike,
          confidence: 'high'
        };
        record.tags = inferTags(record);
        record.role = sceneRole(record);
        records.push(record);
      }
    } else {
      const fallback = path.basename(path.dirname(cfgPath));
      const record = {
        ...baseRecord,
        title: fallback,
        displayName: fallback,
        aliases: [fallback],
        titleSource: 'folder-fallback',
        uiType: '',
        uiVariation: '',
        model: sectionValue(sections, 'model', 'normal') || '',
        spawnCandidate: false,
        sceneCandidate: false,
        confidence: 'low'
      };
      record.tags = inferTags(record);
      record.role = sceneRole(record);
      records.push(record);
    }
  }

  return { records, cfgFileCount: cfgFiles.length };
}

function csvEscape(value) {
  const s = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, records) {
  const headers = [
    'title',
    'displayName',
    'spawnCandidate',
    'sceneCandidate',
    'role',
    'source',
    'packageName',
    'packageTitle',
    'kind',
    'category',
    'objectClass',
    'tags',
    'aliases',
    'uiType',
    'uiVariation',
    'model',
    'path'
  ];
  const lines = [headers.join(';')];
  for (const r of records) lines.push(headers.map((h) => csvEscape(r[h])).join(';'));
  fs.writeFileSync(file, lines.join(os.EOL), 'utf8');
}

function countBy(records, key) {
  return records.reduce((acc, r) => {
    const value = String(r[key] || 'unknown');
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function compactRecord(r) {
  return {
    title: r.title,
    displayName: r.displayName,
    aliases: r.aliases,
    role: r.role,
    tags: r.tags,
    kind: r.kind,
    category: r.category,
    source: r.source,
    packageName: r.packageName,
    packageTitle: r.packageTitle,
    uiType: r.uiType,
    uiVariation: r.uiVariation,
    model: r.model,
    sceneCandidate: r.sceneCandidate,
    path: r.path
  };
}

function topCandidates(records, tags, limit) {
  return records
    .filter((r) => r.sceneCandidate && r.tags.some((t) => tags.includes(t)))
    .sort((a, b) => {
      const aScore = a.tags.filter((t) => tags.includes(t)).length;
      const bScore = b.tags.filter((t) => tags.includes(t)).length;
      return bScore - aScore || String(a.title).localeCompare(String(b.title), 'en');
    })
    .slice(0, limit)
    .map((r) => `${r.title} [${r.role}/${r.kind || r.category || 'unknown'}] pkg=${r.packageName} tags=${r.tags.join(',')}`);
}

function main() {
  const startedAt = new Date();
  const outputDir = path.resolve(argValue(['--out', '--output']) || DEFAULT_OUTPUT_DIR);
  ensureDir(outputDir);

  const includeAircraft = hasArg(['--include-aircraft']);
  const roots = candidatePackageRoots();
  const sources = roots.flatMap(sourceDirsForRoot);
  const debug = [];

  debug.push(`MSFS 2024 Asset Scanner ${TOOL_VERSION}`);
  debug.push(`Started: ${startedAt.toISOString()}`);
  debug.push(`OutputDir: ${outputDir}`);
  debug.push(`Include aircraft: ${includeAircraft ? 'yes' : 'no'}`);
  debug.push(`Package roots: ${roots.length ? roots.join(' | ') : 'not found'}`);
  debug.push(`Sources: ${sources.map((s) => `${s.source}=${s.dir}`).join(' | ') || 'none'}`);
  debug.push('');

  if (!sources.length) {
    debug.push('No package folders found.');
    debug.push('Run with: MSFS2024-Asset-Scanner.exe --packages="D:\\MSFS\\Packages"');
    debug.push('You can also drag a Packages, Official, Community, OneStore, Steam, or single package folder onto the BAT.');
    fs.writeFileSync(path.join(outputDir, `${OUT_BASENAME}-debug.txt`), debug.join(os.EOL), 'utf8');
    console.log(debug.join(os.EOL));
    process.exitCode = 2;
    return;
  }

  let records = [];
  for (const source of sources) {
    const scan = scanSource(source);
    let sourceRecords = scan.records;
    if (!includeAircraft) {
      sourceRecords = sourceRecords.map((r) => {
        const aircraftLike = /(airplane|aircraft|helicopter|rotorcraft)/i.test(`${r.kind} ${r.category} ${r.objectClass}`);
        return aircraftLike ? { ...r, sceneCandidate: false, tags: unique([...(r.tags || []), 'aircraft']) } : r;
      });
    }
    records = records.concat(sourceRecords);
    debug.push(`${source.source}: ${sourceRecords.length} records from ${scan.cfgFileCount} cfg files`);
    if (sourceRecords.length === 0) debug.push(`  Hinweis: Keine SimObjects/**/sim.cfg oder aircraft.cfg gefunden in ${source.dir}`);
    if (sourceRecords.length > 0) {
      const packages = unique(sourceRecords.map((r) => r.packageName)).length;
      debug.push(`  Packages mit Treffern: ${packages}`);
    }
  }

  const seenTitles = new Set();
  records.sort((a, b) => String(a.title).localeCompare(String(b.title), 'en'));
  for (const r of records) {
    const titleKey = `${r.title}||${r.packageName}||${r.path}`.toLowerCase();
    r.duplicateTitleInScan = seenTitles.has(String(r.title).toLowerCase());
    seenTitles.add(String(r.title).toLowerCase());
    r.id = titleKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160);
  }

  const sceneRecords = records.filter((r) => r.sceneCandidate);
  const spawnRecords = records.filter((r) => r.spawnCandidate);
  const payload = {
    tool: 'MSFS2024 Asset Scanner',
    version: TOOL_VERSION,
    createdAt: new Date().toISOString(),
    packageRoots: roots,
    sources,
    counts: {
      records: records.length,
      spawnCandidates: spawnRecords.length,
      sceneCandidates: sceneRecords.length,
      bySource: countBy(records, 'source'),
      byKind: countBy(records, 'kind'),
      byCategory: countBy(records, 'category'),
      byRole: countBy(records, 'role')
    },
    records
  };

  const compactPayload = {
    tool: payload.tool,
    version: payload.version,
    createdAt: payload.createdAt,
    counts: payload.counts,
    records: sceneRecords.map(compactRecord)
  };

  const jsonFile = path.join(outputDir, `${OUT_BASENAME}.json`);
  const compactFile = path.join(outputDir, `${OUT_BASENAME}-catalog.json`);
  const csvFile = path.join(outputDir, `${OUT_BASENAME}.csv`);
  const debugFile = path.join(outputDir, `${OUT_BASENAME}-debug.txt`);
  const candidatesFile = path.join(outputDir, `${OUT_BASENAME}-scene-candidates.txt`);

  fs.writeFileSync(jsonFile, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(compactFile, JSON.stringify(compactPayload, null, 2), 'utf8');
  writeCsv(csvFile, records);

  debug.push('');
  debug.push(`Records: ${payload.counts.records}`);
  debug.push(`Spawn candidates: ${payload.counts.spawnCandidates}`);
  debug.push(`Scene candidates: ${payload.counts.sceneCandidates}`);
  debug.push(`By role: ${JSON.stringify(payload.counts.byRole)}`);
  debug.push(`By kind: ${JSON.stringify(payload.counts.byKind)}`);
  debug.push(`By category: ${JSON.stringify(payload.counts.byCategory)}`);
  debug.push('');
  debug.push(`Wrote: ${jsonFile}`);
  debug.push(`Wrote: ${compactFile}`);
  debug.push(`Wrote: ${csvFile}`);
  fs.writeFileSync(debugFile, debug.join(os.EOL), 'utf8');

  const candidateLines = [
    'Scene candidate quick list',
    `Created: ${payload.createdAt}`,
    '',
    '[Fire / Smoke]',
    ...topCandidates(records, ['fire', 'smoke'], 120),
    '',
    '[SAR / Medical / Police / Accident]',
    ...topCandidates(records, ['sar', 'medical', 'police', 'accident'], 160),
    '',
    '[Airport / People / Vehicles]',
    ...topCandidates(records, ['airport', 'person', 'vehicle'], 220),
    '',
    '[Cargo / Markers / Tools]',
    ...topCandidates(records, ['cargo', 'marker', 'construction'], 160),
    '',
    '[Boats / VIP]',
    ...topCandidates(records, ['boat', 'vip'], 120)
  ];
  fs.writeFileSync(candidatesFile, candidateLines.join(os.EOL), 'utf8');

  console.log(debug.join(os.EOL));
  console.log('');
  console.log(`Wrote: ${candidatesFile}`);
}

main();
