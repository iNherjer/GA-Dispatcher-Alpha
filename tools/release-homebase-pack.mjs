#!/usr/bin/env node
// Prüft ein veröffentlichtes Homebase-Assetpaket und bereitet die Stable-Freigabe vor.
//
//   node tools/release-homebase-pack.mjs --version 0.6.27            # nur prüfen
//   node tools/release-homebase-pack.mjs --version 0.6.27 --write-channel
//
// Erwartet im Arbeitsordner den Stand mit homebase/assets/catalog.json und
// homebase/assets/releases/<version>/package-index.json (z. B. den Staging-Branch).
// Schreibt nur Dateien im Arbeitsordner (Listen unter data/, mit --write-channel
// zusätzlich homebase/assets/channel/stable.json). Kein Commit, kein Push.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkAppearanceFile, checkPersonAsset, isPersonAsset } from './homebase-person-rules.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'iNherjer/GA-Dispatcher-Alpha';
const PACKAGE = 'vfr-multitool-homebase-assets';

const args = process.argv.slice(2);
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };
const version = argValue('--version');
const writeChannel = args.includes('--write-channel');
const skipTests = args.includes('--skip-tests');
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Aufruf: node tools/release-homebase-pack.mjs --version <x.y.z> [--write-channel] [--skip-tests]');
  process.exit(2);
}
const tag = `homebase-assets-v${version}`;
const releaseBase = `https://github.com/${REPO}/releases/download/${tag}`;

const errors = [];
const warnings = [];
const fail = (message) => { errors.push(message); console.log(`  FEHLER  ${message}`); };
const warn = (message) => { warnings.push(message); console.log(`  HINWEIS ${message}`); };
const ok = (message) => console.log(`  ok      ${message}`);
const step = (title) => console.log(`\n${title}`);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function download(url, target) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  return fs.statSync(target).size;
}

// --- Personen-Regeln (tools/homebase-person-rules.mjs) ----------------------------
const vocabulary = readJson(path.join(root, 'data/mission-person-vocabulary.json'));
function checkPerson(asset) {
  const result = checkPersonAsset(asset, vocabulary);
  result.errors.forEach(fail);
  result.warnings.forEach(warn);
}

// --- Ablauf ----------------------------------------------------------------------
const work = fs.mkdtempSync(path.join(os.tmpdir(), `homebase-pack-${version}-`));
try {
  step(`1. Lokaler Stand für ${version}`);
  const catalogPath = path.join(root, 'homebase/assets/catalog.json');
  const localIndexPath = path.join(root, `homebase/assets/releases/${version}/package-index.json`);
  const catalog = readJson(catalogPath);
  if (catalog.package?.version !== version) fail(`catalog.json hat Version ${catalog.package?.version}, erwartet ${version}`);
  else ok(`catalog.json: ${catalog.assets.length} Assets`);
  if (!fs.existsSync(localIndexPath)) throw new Error(`${path.relative(root, localIndexPath)} fehlt – Staging-Branch auschecken?`);
  const localIndex = readJson(localIndexPath);
  ok(`package-index.json: ${localIndex.files.length} Dateien, geändert: ${(localIndex.changedAssets || []).join(', ') || '–'}`);

  step('2. GitHub-Release');
  const tagLine = execFileSync('git', ['ls-remote', 'origin', `refs/tags/${tag}`], { cwd: root, encoding: 'utf8' }).trim();
  if (!tagLine) fail(`Tag ${tag} existiert nicht auf origin`);
  else ok(`Tag ${tag} → ${tagLine.slice(0, 9)}`);
  const releaseIndexFile = path.join(work, 'package-index.json');
  await download(`${releaseBase}/package-index.json`, releaseIndexFile);
  const releaseIndex = readJson(releaseIndexFile);
  if (fs.readFileSync(releaseIndexFile, 'utf8') !== fs.readFileSync(localIndexPath, 'utf8')) fail('Release-Index weicht vom Index im Repository ab');
  else ok('Release-Index = Index im Repository');
  const archive = releaseIndex.fullArchive || {};
  const zipFile = path.join(work, 'full.zip');
  const zipSize = await download(archive.url || `${releaseBase}/${PACKAGE}-${version}-full.zip`, zipFile);
  if (zipSize !== archive.size) fail(`Archivgröße ${zipSize} ≠ ${archive.size}`);
  else ok(`Archiv ${zipSize} Bytes`);
  if (sha256(zipFile) !== archive.sha256) fail('SHA-256 des Archivs weicht ab');
  else ok(`SHA-256 ${archive.sha256.slice(0, 12)}…`);

  step('3. Paketinhalt');
  const extract = path.join(work, 'x');
  fs.mkdirSync(extract);
  execFileSync('unzip', ['-q', zipFile, '-d', extract]);
  spawnSync('chmod', ['-R', 'u+rwX', extract]);
  const tops = fs.readdirSync(extract).filter((name) => fs.statSync(path.join(extract, name)).isDirectory());
  if (tops.length !== 1 || tops[0] !== PACKAGE) fail(`Archiv muss genau den Ordner ${PACKAGE} enthalten (gefunden: ${tops.join(', ')})`);
  const pkg = path.join(extract, tops[0] || PACKAGE);
  const actual = new Map();
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else actual.set(path.relative(pkg, full).split(path.sep).join('/'), full);
  });
  walk(pkg);
  let badFiles = 0;
  for (const file of releaseIndex.files) {
    const full = actual.get(file.path);
    if (!full) { badFiles += 1; fail(`fehlt im Archiv: ${file.path}`); continue; }
    if (fs.statSync(full).size !== file.size || sha256(full) !== file.sha256) { badFiles += 1; fail(`abweichend: ${file.path}`); }
  }
  const extra = [...actual.keys()].filter((name) => !releaseIndex.files.some((file) => file.path === name));
  if (extra.length) fail(`zusätzliche Dateien im Archiv: ${extra.slice(0, 5).join(', ')}`);
  if (!badFiles && !extra.length) ok(`alle ${releaseIndex.files.length} Dateien stimmen mit dem Index überein`);
  const lower = new Map([...actual].map(([name, full]) => [name.toLowerCase(), full]));
  const manifest = readJson(lower.get('manifest.json'));
  if (manifest.package_version !== version) fail(`manifest.json meldet ${manifest.package_version}`);
  else ok(`manifest.json ${version}`);
  const layout = readJson(lower.get('layout.json'));
  const layoutBad = layout.content.filter((entry) => !lower.has(entry.path.toLowerCase())
    || fs.statSync(lower.get(entry.path.toLowerCase())).size !== Number(entry.size));
  if (layoutBad.length) fail(`layout.json passt nicht: ${layoutBad.slice(0, 3).map((e) => e.path).join(', ')}`);
  else ok(`layout.json ${layout.content.length} Einträge`);
  const missingSimCfg = releaseIndex.assets.filter((asset) => !lower.has(`simobjects/misc/${String(asset.folder).toLowerCase()}/sim.cfg`));
  if (missingSimCfg.length) fail(`sim.cfg fehlt unter SimObjects/Misc (Tracker-Pflicht): ${missingSimCfg.map((a) => a.folder).join(', ')}`);
  else ok('jedes Asset hat SimObjects/Misc/<folder>/sim.cfg');
  for (const asset of releaseIndex.assets) {
    const simCfg = lower.get(`simobjects/misc/${String(asset.folder).toLowerCase()}/sim.cfg`);
    if (!simCfg) continue;
    const title = fs.readFileSync(simCfg, 'utf8').match(/^title\s*=\s*(.+)$/mi)?.[1]?.trim();
    if (title !== asset.title) fail(`${asset.key}: Titel in sim.cfg "${title}" ≠ Katalog "${asset.title}"`);
  }

  step('4. Katalog und Personen');
  // The index adds publisher fields (hashes, files, archive); compare the catalogue fields only.
  const indexByKey = new Map(releaseIndex.assets.map((asset) => [asset.key, asset]));
  const catalogMismatch = [];
  if (releaseIndex.assets.length !== catalog.assets.length) catalogMismatch.push(`Anzahl ${releaseIndex.assets.length} ≠ ${catalog.assets.length}`);
  for (const asset of catalog.assets) {
    const released = indexByKey.get(asset.key);
    if (!released) { catalogMismatch.push(`${asset.key} fehlt im Release`); continue; }
    for (const [field, value] of Object.entries(asset)) {
      if (field !== 'updatedAt' && !sameJson(value, released[field])) catalogMismatch.push(`${asset.key}.${field}`);
    }
  }
  if (catalogMismatch.length) fail(`Katalog im Release weicht von catalog.json ab: ${catalogMismatch.slice(0, 6).join(', ')}`);
  else ok('Release-Katalog = catalog.json');
  const people = catalog.assets.filter(isPersonAsset);
  people.forEach(checkPerson);
  ok(`${people.length} Person(en) geprüft: ${people.map((p) => p.key).join(', ') || '–'}`);
  // Steckbrief des Artists (Quellen/<folder>/person-appearance.json) muss zum Katalog passen.
  for (const folder of [...new Set(people.map((asset) => asset.folder))]) {
    const sidecar = path.join(root, 'homebase/assets/source/SimObjects/Misc', folder, 'person-appearance.json');
    if (!fs.existsSync(sidecar)) { warn(`${folder}: kein Steckbrief person-appearance.json in der Rohquelle`); continue; }
    const doc = readJson(sidecar);
    const result = checkAppearanceFile(doc, vocabulary);
    result.errors.forEach((message) => fail(`Steckbrief ${folder}: ${message}`));
    result.warnings.forEach((message) => warn(`Steckbrief ${folder}: ${message}`));
    for (const figure of doc.figures || []) {
      const asset = people.find((entry) => entry.title === figure.title);
      if (!asset) { fail(`Steckbrief ${folder}: ${figure.title} steht nicht im Katalog`); continue; }
      if (!sameJson(figure.appearance, asset.person?.appearance)) fail(`${asset.key}: person.appearance weicht vom Steckbrief ab`);
      if (figure.gender !== asset.person?.gender) fail(`${asset.key}: gender weicht vom Steckbrief ab`);
    }
  }

  step('5. Missionslisten neu erzeugen');
  for (const script of ['tools/generate-homebase-scene-assets.mjs', 'tools/generate-mission-cargo-assets.mjs']) {
    const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    if (run.status !== 0) fail(`${script}: ${run.stderr.trim()}`);
    else ok(run.stdout.trim().split('\n').filter((line) => !line.startsWith('WARN')).join(' | '));
    for (const line of (run.stdout + run.stderr).split('\n').filter((l) => l.startsWith('WARN'))) warn(line.replace(/^WARN\s*/, ''));
  }
  const changed = execFileSync('git', ['status', '--short', '--', 'data/mission-cargo-assets.js', 'data/mission-homebase-scene-assets.js'], { cwd: root, encoding: 'utf8' }).trim();
  console.log(changed ? `  geändert (bitte mit committen, sw.js erhöhen):\n${changed.replace(/^/gm, '    ')}` : '  ok      Listen unverändert');

  if (!skipTests) {
    step('6. Tests');
    const tests = [
      ['tools', ['--test', 'tools/mission-homebase-scene-assets.test.mjs']],
      ['tools', ['--test', 'tools/mission-cargo-visual.test.mjs']],
      ['tools', ['--test', 'tools/homebase-scene-core.test.cjs']],
      ['tools', ['--test', 'tools/homebase-person-rules.test.mjs']],
      ['ga-tracker-client', ['--test', 'homebase-pack-people.test.js']]
    ];
    for (const [dir, testArgs] of tests) {
      const run = spawnSync(process.execPath, testArgs, { cwd: dir === 'tools' ? root : path.join(root, dir), encoding: 'utf8', timeout: 180000 });
      const summary = (run.stdout.match(/^ℹ (pass|fail) \d+/gm) || []).join(' ');
      if (run.status !== 0) fail(`${testArgs[1]}: ${summary || 'fehlgeschlagen'}`);
      else ok(`${testArgs[1]}: ${summary}`);
    }
  }

  step('7. Stable-Kanal');
  const channel = {
    schemaVersion: 1,
    publishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    packageName: releaseIndex.packageName,
    packageVersion: releaseIndex.packageVersion,
    releaseTag: releaseIndex.releaseTag,
    indexUrl: `${releaseBase}/package-index.json`,
    contentHash: releaseIndex.contentHash,
    fullArchive: releaseIndex.fullArchive,
    changedAssets: releaseIndex.changedAssets || [],
    removedAssets: releaseIndex.removedAssets || []
  };
  const channelPath = path.join(root, 'homebase/assets/channel/stable.json');
  const current = readJson(channelPath);
  console.log(`  aktuell ${current.packageVersion}, vorbereitet ${channel.packageVersion}`);
  if (errors.length) {
    console.log('  Kanal NICHT geschrieben (Fehler oben).');
  } else if (writeChannel) {
    fs.writeFileSync(channelPath, `${JSON.stringify(channel, null, 2)}\n`);
    console.log('  stable.json geschrieben – prüfen, committen, pushen.');
  } else {
    console.log('  Prüfung bestanden. Kanal schreiben mit --write-channel (nur nach Freigabe).');
  }
} catch (error) {
  fail(error?.message || String(error));
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log(`\nErgebnis: ${errors.length} Fehler, ${warnings.length} Hinweis(e).`);
process.exit(errors.length ? 1 : 0);
