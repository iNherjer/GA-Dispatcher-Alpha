#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(root, 'Homebase-Asset-Publisher-Data');
const sourceCatalog = path.join(dataRoot, 'catalog.json');
const sourceObjects = path.join(dataRoot, 'source', 'SimObjects', 'Misc');
const seedRoot = path.join(root, 'seed');
const expectedName = 'vfr-multitool-homebase-assets';
const expectedVersion = '0.6.3';

const catalog = JSON.parse(fs.readFileSync(sourceCatalog, 'utf8'));
if (catalog?.package?.name !== expectedName || catalog?.package?.version !== expectedVersion) {
  throw new Error(`Seed wird nur aus ${expectedName} ${expectedVersion} erzeugt.`);
}
if (!fs.existsSync(sourceObjects)) throw new Error(`Aktive Rohquellen fehlen: ${sourceObjects}`);

fs.rmSync(path.join(seedRoot, 'PackageSources'), { recursive: true, force: true });
fs.cpSync(sourceObjects, path.join(seedRoot, 'PackageSources', 'SimObjects', 'Misc'), { recursive: true });
fs.writeFileSync(path.join(seedRoot, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Seed aktualisiert: ${catalog.assets.length} Assets, ${catalog.package.name} ${catalog.package.version}`);
