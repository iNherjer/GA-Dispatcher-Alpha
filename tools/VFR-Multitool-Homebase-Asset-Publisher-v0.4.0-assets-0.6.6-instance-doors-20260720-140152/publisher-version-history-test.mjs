#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublisher, nextPatchVersion } from './publisher-core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'homebase-publisher-history-'));
const dataRoot = path.join(tempRoot, 'data');
const incomingRoot = path.join(tempRoot, 'incoming', 'VFRHomebaseBriefcase');
const checks = [];

function check(condition, name) {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) throw new Error(name);
}

try {
  const publisher = createPublisher({ distributionRoot: root, seedRoot: path.join(root, 'seed'), dataRoot });
  const before = publisher.getCatalog().assets.find((asset) => asset.key === 'briefcase');
  check(Boolean(before), 'Testasset briefcase vorhanden');
  check(nextPatchVersion(before.version) === '1.0.1', 'Patchversion wird korrekt erhöht');

  fs.cpSync(path.join(publisher.paths.sourceRoot, before.folder), incomingRoot, { recursive: true });
  const gltfPath = path.join(incomingRoot, 'model', 'HomebaseBriefcase_LOD00.gltf');
  const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
  gltf.extras = { ...(gltf.extras || {}), versionHistoryTest: true };
  fs.writeFileSync(gltfPath, `${JSON.stringify(gltf, null, 2)}\n`, 'utf8');

  const inspected = publisher.inspectSourceAssets({ sourcePath: incomingRoot }).assets[0];
  check(inspected.isReplacement === true, 'Vorhandenes Asset wird erkannt');
  check(inspected.existingKey === before.key, 'Bestehender Key wird erkannt');
  check(inspected.existingVersion === before.version, 'Bestehende Version wird gemeldet');
  check(inspected.suggestedVersion === nextPatchVersion(before.version), 'Nächste Patchversion wird vorgeschlagen');

  let sameVersionRejected = false;
  try {
    publisher.importAsset({ ...inspected.suggested, version: before.version, sourcePath: incomingRoot, confirmed: true });
  } catch (error) {
    sameVersionRejected = /Neue Assetversion/.test(error.message) && /vorhandene Version/.test(error.message);
  }
  check(sameVersionRejected, 'Gleiche Assetversion wird abgelehnt');

  const result = publisher.importAsset({ ...inspected.suggested, sourcePath: incomingRoot, confirmed: true });
  check(result.asset.version === nextPatchVersion(before.version), 'Neue Assetversion wird gespeichert');
  check(result.history?.version === before.version, 'Vorherige Version wird gesichert');
  check(fs.existsSync(path.join(result.history.path, 'source', 'sim.cfg')), 'Historie enthält vollständige Rohquelle');
  check(fs.existsSync(path.join(result.history.path, 'catalog-entry.json')), 'Historie enthält Katalogeintrag');
  check(fs.existsSync(path.join(result.history.path, 'package-info.json')), 'Historie enthält Paketstand');
  const snapshot = JSON.parse(fs.readFileSync(path.join(result.history.path, 'snapshot.json'), 'utf8'));
  check(snapshot.sourceFiles.length >= 5 && snapshot.sourceFiles.every((file) => file.sha256), 'Historie enthält Datei-Hashes');
  check(JSON.parse(fs.readFileSync(path.join(publisher.paths.sourceRoot, before.folder, 'model', 'HomebaseBriefcase_LOD00.gltf'), 'utf8')).extras?.versionHistoryTest === true, 'Neue Rohquelle wurde nach Sicherung installiert');
  check(JSON.parse(fs.readFileSync(path.join(publisher.paths.sourceRoot, before.folder, 'homebase-asset.json'), 'utf8')).version === result.asset.version, 'Sidecar erhält die neue Assetversion');

  console.log(JSON.stringify({ ok: true, checks, tempRoot }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, checks, error: error.stack || error.message, tempRoot }, null, 2));
  process.exitCode = 1;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
