const fs = require('fs');
const path = require('path');
const os = require('os');

const TOOL_VERSION = 'v1';
const OUT_BASENAME = 'msfs2024-simobjects';
const OUTPUT_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

function argValue(names) {
  for (const raw of process.argv.slice(2)) {
    const eq = raw.indexOf('=');
    const key = eq >= 0 ? raw.slice(0, eq) : raw;
    const val = eq >= 0 ? raw.slice(eq + 1) : '';
    if (names.includes(key)) return val.replace(/^"|"$/g, '');
  }
  return '';
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
  const manual = argValue(['--packages', '--packagesPath', '--root']);
  const envRoot = process.env.MSFS2024_PACKAGES || '';
  const roots = [manual, envRoot];
  for (const cfg of candidateUserCfgFiles()) {
    if (existsFile(cfg)) roots.push(parseInstalledPackagesPath(cfg));
  }
  const localAppData = process.env.LOCALAPPDATA || '';
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

function sourceDirsForRoot(root) {
  const base = path.basename(root).toLowerCase();
  if (/^(community|community2024|official2020|official2024|streamedpackages)$/i.test(base)) {
    return [{ source: path.basename(root), dir: root }];
  }
  return ['Official2024', 'StreamedPackages', 'Community2024', 'Community', 'Official2020']
    .map(source => ({ source, dir: path.join(root, source) }))
    .filter(entry => existsDir(entry.dir));
}

function walkCfgFiles(sourceDir) {
  const out = [];
  const stack = [sourceDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/^(html_ui|sound|texture|textures|effects|materiallib)$/i.test(entry.name)) continue;
        stack.push(full);
      } else if (/^(sim|aircraft)\.cfg$/i.test(entry.name) && full.toLowerCase().includes(`${path.sep.toLowerCase()}simobjects${path.sep.toLowerCase()}`)) {
        out.push(full);
      }
    }
  }
  return out;
}

function parseCfg(text) {
  const sections = {};
  let current = 'global';
  sections[current] = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('//')) continue;
    const sec = line.match(/^\[([^\]]+)\]$/);
    if (sec) {
      current = sec[1].trim();
      if (!sections[current]) sections[current] = {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).split(';')[0].trim().replace(/^"|"$/g, '');
    sections[current][key] = value;
  }
  return sections;
}

function sectionValue(sections, sectionName, key) {
  const wanted = String(sectionName || '').toLowerCase();
  const wantedKey = String(key || '').toLowerCase();
  for (const [section, data] of Object.entries(sections)) {
    if (section.toLowerCase() !== wanted) continue;
    for (const [k, v] of Object.entries(data)) {
      if (k.toLowerCase() === wantedKey) return v;
    }
  }
  return '';
}

function titleSections(sections) {
  const out = [];
  for (const [section, data] of Object.entries(sections)) {
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase() === 'title' && String(value || '').trim()) {
        out.push({ section, title: String(value).trim(), data });
      }
    }
  }
  return out;
}

function packageNameFor(cfgPath, sourceDir) {
  const rel = path.relative(sourceDir, cfgPath);
  const parts = rel.split(path.sep);
  return parts.length > 1 ? parts[0] : '';
}

function simObjectKind(cfgPath) {
  const parts = cfgPath.split(path.sep).map(p => p.toLowerCase());
  const idx = parts.findIndex(p => p === 'simobjects');
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
}

function inferTags(record) {
  const hay = `${record.title} ${record.category} ${record.kind} ${record.path}`.toLowerCase();
  const tags = [];
  const add = (tag, re) => { if (re.test(hay)) tags.push(tag); };
  add('fire', /(fire|firefight|feuer|brand|bush)/);
  add('smoke', /(smoke|rauch|chimney)/);
  add('sar', /(sar|rescue|search|rettung|lifeguard)/);
  add('medical', /(medical|ambulance|medic|doctor|hospital)/);
  add('police', /(police|law|security)/);
  add('person', /(human|person|tarmac|marshall|character|female|male|pilot)/);
  add('vehicle', /(vehicle|car|truck|bus|van|groundvehicle|tractor|fuel|pushback|follow)/);
  add('boat', /(boat|ship|vessel|ferry|tug)/);
  add('animal', /(animal|cow|horse|sheep|bird|whale|deer)/);
  add('airport', /(airport|tarmac|marshaller|baggage|fuel|pushback|stairs|catering)/);
  add('cargo', /(cargo|container|crate|box|freight)/);
  add('construction', /(construction|crane|worker|dozer|excavator)/);
  return unique(tags);
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
    const packageName = packageNameFor(cfgPath, source.dir);
    const relPath = path.relative(source.dir, cfgPath);
    const baseRecord = {
      source: source.source,
      packageName,
      kind,
      category,
      objectClass,
      cfg: path.basename(cfgPath),
      path: relPath,
      absolutePath: cfgPath
    };
    if (titles.length) {
      for (const item of titles) {
        const record = {
          ...baseRecord,
          title: item.title,
          titleSource: item.section,
          uiType: item.data.ui_type || item.data.ui_createdby || '',
          uiVariation: item.data.ui_variation || '',
          model: item.data.model || sectionValue(sections, 'model', 'normal') || '',
          spawnCandidate: true
        };
        record.tags = inferTags(record);
        records.push(record);
      }
    } else {
      const fallback = path.basename(path.dirname(cfgPath));
      const record = {
        ...baseRecord,
        title: fallback,
        titleSource: 'folder-fallback',
        uiType: '',
        uiVariation: '',
        model: sectionValue(sections, 'model', 'normal') || '',
        spawnCandidate: false
      };
      record.tags = inferTags(record);
      records.push(record);
    }
  }
  return records;
}

function csvEscape(value) {
  const s = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, records) {
  const headers = ['title', 'spawnCandidate', 'source', 'packageName', 'kind', 'category', 'objectClass', 'tags', 'titleSource', 'uiType', 'uiVariation', 'model', 'path'];
  const lines = [headers.join(';')];
  for (const r of records) {
    lines.push(headers.map(h => csvEscape(r[h])).join(';'));
  }
  fs.writeFileSync(file, lines.join(os.EOL), 'utf8');
}

function countBy(records, key) {
  return records.reduce((acc, r) => {
    const value = String(r[key] || 'unknown');
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topCandidates(records, tags) {
  return records
    .filter(r => r.spawnCandidate && r.tags.some(t => tags.includes(t)))
    .slice(0, 80)
    .map(r => `${r.title} [${r.kind || r.category || 'unknown'}] ${r.tags.join(',')}`);
}

function main() {
  const startedAt = new Date();
  const roots = candidatePackageRoots();
  const sources = roots.flatMap(sourceDirsForRoot);
  const debug = [];
  debug.push(`MSFS 2024 Asset Scanner ${TOOL_VERSION}`);
  debug.push(`Started: ${startedAt.toISOString()}`);
  debug.push(`OutputDir: ${OUTPUT_DIR}`);
  debug.push(`Package roots: ${roots.length ? roots.join(' | ') : 'not found'}`);
  debug.push(`Sources: ${sources.map(s => `${s.source}=${s.dir}`).join(' | ') || 'none'}`);
  debug.push('');

  if (!sources.length) {
    debug.push('No package folders found. Run with: MSFS2024-Asset-Scanner.exe --packages="D:\\MSFS\\Packages"');
    fs.writeFileSync(path.join(OUTPUT_DIR, `${OUT_BASENAME}-debug.txt`), debug.join(os.EOL), 'utf8');
    console.log(debug.join(os.EOL));
    process.exitCode = 2;
    return;
  }

  let records = [];
  for (const source of sources) {
    const before = records.length;
    const sourceRecords = scanSource(source);
    records = records.concat(sourceRecords);
    debug.push(`${source.source}: ${sourceRecords.length} records`);
    if (sourceRecords.length === 0) debug.push(`  Hinweis: Keine SimObjects/**/sim.cfg oder aircraft.cfg gefunden in ${source.dir}`);
    if (records.length - before > 0) {
      const packages = unique(sourceRecords.map(r => r.packageName)).length;
      debug.push(`  Packages mit Treffern: ${packages}`);
    }
  }

  records.sort((a, b) => String(a.title).localeCompare(String(b.title), 'en'));
  const payload = {
    tool: 'MSFS2024 Asset Scanner',
    version: TOOL_VERSION,
    createdAt: new Date().toISOString(),
    packageRoots: roots,
    sources,
    counts: {
      records: records.length,
      spawnCandidates: records.filter(r => r.spawnCandidate).length,
      bySource: countBy(records, 'source'),
      byKind: countBy(records, 'kind'),
      byCategory: countBy(records, 'category')
    },
    records
  };

  const jsonFile = path.join(OUTPUT_DIR, `${OUT_BASENAME}.json`);
  const csvFile = path.join(OUTPUT_DIR, `${OUT_BASENAME}.csv`);
  const debugFile = path.join(OUTPUT_DIR, `${OUT_BASENAME}-debug.txt`);
  const candidatesFile = path.join(OUTPUT_DIR, `${OUT_BASENAME}-scene-candidates.txt`);
  fs.writeFileSync(jsonFile, JSON.stringify(payload, null, 2), 'utf8');
  writeCsv(csvFile, records);

  debug.push('');
  debug.push(`Records: ${payload.counts.records}`);
  debug.push(`Spawn candidates: ${payload.counts.spawnCandidates}`);
  debug.push(`By kind: ${JSON.stringify(payload.counts.byKind)}`);
  debug.push(`By category: ${JSON.stringify(payload.counts.byCategory)}`);
  debug.push('');
  debug.push(`Wrote: ${jsonFile}`);
  debug.push(`Wrote: ${csvFile}`);
  fs.writeFileSync(debugFile, debug.join(os.EOL), 'utf8');

  const candidateLines = [
    'Scene candidate quick list',
    `Created: ${payload.createdAt}`,
    '',
    '[Fire / Smoke]',
    ...topCandidates(records, ['fire', 'smoke']),
    '',
    '[SAR / Medical / Police]',
    ...topCandidates(records, ['sar', 'medical', 'police']),
    '',
    '[Airport / People / Vehicles]',
    ...topCandidates(records, ['airport', 'person', 'vehicle']).slice(0, 120)
  ];
  fs.writeFileSync(candidatesFile, candidateLines.join(os.EOL), 'utf8');

  console.log(debug.join(os.EOL));
  console.log('');
  console.log(`Wrote: ${candidatesFile}`);
}

main();
