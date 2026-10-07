const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { extractZipBuffer } = require('../ga-tracker-client/homebase-asset-updater');
const root = path.resolve(__dirname, '..');
const efb = path.join(root, 'ga-tracker-client/efb-app');
const pkg = path.join(efb, 'Packages/vfr-multitool-efb');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [p];
  });
}
const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'manifest.json')));
assert.equal(manifest.package_version, '0.4.22');
assert.equal(manifest.builder, 'Microsoft Flight Simulator 2024');
const layout = JSON.parse(fs.readFileSync(path.join(pkg, 'layout.json'))).content;
const names = new Set();
for (const row of layout) {
  assert.ok(!names.has(row.path.toLowerCase()), 'duplicate layout entry');
  names.add(row.path.toLowerCase());
  const p = path.resolve(pkg, row.path);
  assert.ok(p.startsWith(pkg + path.sep), 'layout path escapes package');
  assert.equal(fs.statSync(p).size, row.size, row.path);
}
const payload = files(pkg).filter(f => !['manifest.json', 'layout.json'].includes(path.basename(f)));
assert.equal(payload.length, layout.length);
for (const f of payload) assert.ok(names.has(path.relative(pkg, f).replaceAll('\\', '/').toLowerCase()));
const copies = [];
for (const [source, destination] of [
  [path.join(efb, 'PackageSources/VfrMultitool/dist'), 'html_ui/efb_ui/efb_apps/vfrmultitool'],
  [path.join(root, 'ga-tracker-client/toolbar-panel/PackageSources/html_ui'), 'html_ui']
]) {
  for (const f of files(source)) {
    const rel = path.relative(source, f);
    const out = path.join(pkg, destination, rel);
    assert.equal(hash(f), hash(out), 'SDK Copy payload mismatch: ' + rel);
    copies.push({ source: path.relative(root, f).replaceAll('\\', '/'), destination: path.relative(pkg, out).replaceAll('\\', '/'), sha256: hash(out), bytes: fs.statSync(out).size });
  }
}
assert.ok(fs.statSync(path.join(pkg, 'InGamePanels/InGamePanel_VfrMultitool.spb')).size > 0);
assert.equal(fs.readFileSync(path.join(efb, '_PackageInt/_RPTErrors.xml'), 'utf8').trim(), '<RPTErrors/>');
const archive = path.join(efb, 'release-output/vfr-multitool-efb-0.4.22.zip');
const extractedRoot = fs.mkdtempSync(path.join(root, 'verified-archive-'));
const extraction = extractZipBuffer(fs.readFileSync(archive), extractedRoot, { maxEntries: 2000, maxExtractedBytes: 128 * 1024 * 1024 });
const packageFiles = files(pkg);
const archiveFiles = files(extractedRoot).length;
assert.equal(archiveFiles, packageFiles.length);
assert.ok(extraction.names.every(n => n === 'vfr-multitool-efb' || n.startsWith('vfr-multitool-efb/')));
for (const f of packageFiles) assert.equal(hash(f), hash(path.join(extractedRoot, 'vfr-multitool-efb', path.relative(pkg, f))));
const result = { version: manifest.package_version, sdkErrors: 0, layoutEntries: layout.length, copyPayloads: copies.length,
  archiveFiles, archiveBytes: fs.statSync(archive).size, archiveSha256: hash(archive), copies };
fs.writeFileSync(path.join(root, 'logs/08-package-validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, copies: undefined }, null, 2));
