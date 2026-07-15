'use strict';

const fs = require('fs');
const path = require('path');
const catalog = require('./homebase-asset-catalog.js');

const source = path.resolve(
  __dirname,
  '..',
  'homebase',
  'generated',
  'vfr-multitool-homebase-assets-sdk',
  'Packages',
  catalog.assetPackageName
);
const targetRoot = path.join(__dirname, 'embedded-homebase-assets');
const target = path.join(targetRoot, catalog.assetPackageName);

function validatePackage(root) {
  const manifestPath = path.join(root, 'manifest.json');
  const layoutPath = path.join(root, 'layout.json');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(layoutPath)) {
    throw new Error(`Kompiliertes Homebase-Assetpaket fehlt oder ist unvollständig: ${root}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  if (String(manifest.package_version || '') !== catalog.assetPackageVersion) {
    throw new Error(`Assetpaket ${manifest.package_version || '(ohne Version)'} passt nicht zum Katalog ${catalog.assetPackageVersion}.`);
  }
  for (const entry of layout.content || []) {
    const file = path.join(root, ...String(entry.path || '').split('/'));
    if (!fs.existsSync(file)) throw new Error(`Assetpaket-Datei fehlt: ${entry.path}`);
    if (Number(fs.statSync(file).size) !== Number(entry.size)) throw new Error(`Assetpaket-Dateigröße stimmt nicht: ${entry.path}`);
  }
  for (const asset of catalog.assets) {
    const simCfg = path.join(root, 'SimObjects', 'Misc', asset.folder, 'sim.cfg');
    if (!fs.existsSync(simCfg)) throw new Error(`Assetdefinition fehlt: ${asset.folder}/sim.cfg`);
  }
  return { manifest, fileCount: (layout.content || []).length + 2 };
}

const sourceInfo = validatePackage(source);
fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(targetRoot, { recursive: true });
fs.cpSync(source, target, { recursive: true, force: true });
const targetInfo = validatePackage(target);

console.log(`Homebase-Assetpaket ${targetInfo.manifest.package_version} für EXE vorbereitet: ${targetInfo.fileCount} Dateien aus ${sourceInfo.fileCount}.`);
