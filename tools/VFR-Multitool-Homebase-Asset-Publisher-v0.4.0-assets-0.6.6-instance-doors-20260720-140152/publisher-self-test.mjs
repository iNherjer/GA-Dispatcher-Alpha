#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import visibilityPolicy from './asset-visibility-policy.js';
import { assetMetadataHash, normalizeControl, safeAsset } from './publisher-core.mjs';
import { createSceneXml } from './tools/generate-homebase-scene-package.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(root, 'Homebase-Asset-Publisher-Data');
const catalogPath = path.join(dataRoot, 'catalog.json');
const sourceRoot = path.join(dataRoot, 'source', 'SimObjects', 'Misc');
const seedRoot = path.join(root, 'seed');
const packageName = 'vfr-multitool-homebase-assets';
const banned = ['vfr-multitool-homebase-test-assets', 'VFRHomebaseTestHangar', 'VFR Multitool Homebase Test Hangar', 'HomebaseTestHangar'];
const failures = [];
const checks = [];

function check(condition, name, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function files(rootPath) {
  if (!fs.existsSync(rootPath)) return [];
  const found = [];
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const absolute = path.join(rootPath, entry.name);
    if (entry.isDirectory()) found.push(...files(absolute));
    else if (entry.isFile()) found.push(absolute);
  }
  return found;
}

const catalog = readJson(catalogPath);
const version = String(catalog?.package?.version || '');
check(catalog.package.name === packageName, 'Produktionspaketname', catalog.package.name);
check(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version), 'Produktionspaketversion', version || 'fehlt');
check(Array.isArray(catalog.assets) && catalog.assets.length >= 20, 'Katalog enthält mindestens 20 Assets', String(catalog.assets?.length));
for (const key of ['briefcase', 'cabinTrolley', 'travelSuitcase']) check(catalog.assets.some((asset) => asset.key === key), `Katalog enthält ${key}`);
check(catalog.assets.every((asset) => visibilityPolicy.normalizeAssetEntry(asset).workbenchVisible === true), 'Legacy-Katalogeinträge bleiben in der Workbench sichtbar');
const hiddenMissionAsset = visibilityPolicy.normalizeAssetEntry({
  key: 'self-test-mission-only', kind: 'object', title: 'Self Test Mission Only',
  workbenchVisible: false, missionSpawnable: true, missionRoles: ['cargo', 'scene-prop']
});
check(hiddenMissionAsset.workbenchVisible === false && hiddenMissionAsset.missionSpawnable === true, 'Ausgeblendetes Missionsasset behält Missionsmetadaten');
check([...catalog.assets, hiddenMissionAsset].some((asset) => asset.key === hiddenMissionAsset.key), 'Ausgeblendetes Missionsasset bleibt Teil des Releasekatalogs');

const hangar = catalog.assets.find((asset) => asset.key === 'hangar');
check(hangar?.folder === 'VFRHomebaseHangar', 'Aktiver Hangarordner', hangar?.folder || 'fehlt');
check(hangar?.title === 'VFR Multitool Homebase Hangar', 'Aktiver Hangartitel', hangar?.title || 'fehlt');
const roundHangar = catalog.assets.find((asset) => asset.key === 'roundHangar');
check(roundHangar?.kind === 'hangar', 'Rundhangar ist ein Hangar', roundHangar?.kind || 'fehlt');
check(roundHangar?.version === '1.0.2', 'Rundhangar-Assetversion = 1.0.2', roundHangar?.version || 'fehlt');
check(roundHangar?.homebasePlaceable === true, 'Rundhangar ist als Deko platzierbar');
check(roundHangar?.animation?.type === 'door', 'Rundhangar definiert eine Toranimation');
check(roundHangar?.animation?.defaultState === 'open', 'Rundhangar startet offen');
check(roundHangar?.animation?.durationMs === 5000, 'Rundhangar-Toranimation dauert fünf Sekunden');
check(roundHangar?.animation?.control?.simvar === 'L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND', 'Rundhangar nutzt die objektlokale SimConnect-L:Variable');
check(roundHangar?.animation?.control?.scope === 'simobject', 'Legacy-Toranimation behält scope=simobject');
check(roundHangar?.headingCorrectionDeg === 0, 'Rundhangar headingCorrectionDeg = 0');
check(hangar?.headingCorrectionDeg === 180, 'Haupthangar headingCorrectionDeg = 180');
check(catalog.assets.find((asset) => asset.key === 'openParking')?.headingCorrectionDeg === 180, 'Open Parking headingCorrectionDeg = 180');
const doorControl = roundHangar?.controls?.find((control) => control.id === 'door');
const lightControl = roundHangar?.controls?.find((control) => control.id === 'interiorLight');
check(doorControl?.durationMs === 5000, 'Door durationMs = 5000');
check(doorControl?.simvar === 'L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND' && doorControl?.scope === 'simobject', 'Door-Control ist instanzlokal');
check(lightControl?.simvar === 'L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND', 'Light-Control vorhanden');
check(lightControl?.scope === 'global', 'Innenbeleuchtung bleibt global');
check(roundHangar?.collisionProfile?.modelLibGuid === '{B90D5EAB-0F9C-4A2A-9917-F57D81E3A24C}', 'Stabiler Collision-ModelLib-GUID');
check(roundHangar?.collisionProfile?.groundSurface === 'walls-and-columns-only', 'Rundhangar hat nur Wand- und Stützenkollision');
check(roundHangar?.collisionProfile?.belowGradeExtensionM === 1.5 && roundHangar?.collisionProfile?.floorCollision === false, 'Wände, Stützen und Tor reichen 1,5 m unter Grund; keine Bodenkollision');
check(!roundHangar?.vegetationExclusion, 'Rundhangar erzwingt ohne Boden keinen Vegetationsausschluss');

const legacyOnly = { ...roundHangar, controls: undefined };
const migratedLegacy = safeAsset(legacyOnly, {});
check(migratedLegacy.controls?.some((control) => control.id === 'door'), 'Alte animation wird als Control migriert');
check(migratedLegacy.animation?.type === 'door', 'Legacy animation bleibt kompatibel vorhanden');
const roundTrip = safeAsset(JSON.parse(JSON.stringify(roundHangar)), roundHangar);
check(JSON.stringify(roundTrip.controls) === JSON.stringify(roundHangar.controls), 'Controls bleiben nach Bearbeiten und Neuladen erhalten');
let foreignLvarRejected = false;
try { normalizeControl({ ...doorControl, simvar: 'L:FOREIGN_DOOR' }); } catch (_) { foreignLvarRejected = true; }
check(foreignLvarRejected, 'Ungültige fremde LVar wird abgelehnt');
const localZControl = normalizeControl({ ...doorControl, simvar: 'Z:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND', scope: 'simobject' });
check(localZControl.simvar.startsWith('Z:') && localZControl.scope === 'simobject', 'Z-Variable wird für scope=simobject akzeptiert');
let localVarWithGlobalScopeRejected = false;
try { normalizeControl({ ...doorControl, scope: 'global' }); } catch (_) { localVarWithGlobalScopeRejected = true; }
check(localVarWithGlobalScopeRejected, 'Objektlokale LVar wird für scope=global abgelehnt');
let globalVarWithLocalScopeRejected = false;
try { normalizeControl({ ...lightControl, scope: 'simobject' }); } catch (_) { globalVarWithLocalScopeRejected = true; }
check(globalVarWithLocalScopeRejected, 'Globale LVar wird für scope=simobject abgelehnt');
let duplicateControlRejected = false;
try { safeAsset({ ...roundHangar, controls: [doorControl, doorControl] }, roundHangar); } catch (_) { duplicateControlRejected = true; }
check(duplicateControlRejected, 'Doppelte Control-ID wird abgelehnt');
let duplicateStateRejected = false;
try { normalizeControl({ ...doorControl, states: [doorControl.states[0], doorControl.states[0]] }); } catch (_) { duplicateStateRejected = true; }
check(duplicateStateRejected, 'Doppelte State-ID wird abgelehnt');
check(assetMetadataHash(roundHangar) !== assetMetadataHash({ ...roundHangar, headingCorrectionDeg: 1 }), 'Metadata-only Änderung verändert metadataHash');

const roundModelRoot = path.join(sourceRoot, roundHangar.folder, 'model');
const roundSidecar = readJson(path.join(sourceRoot, roundHangar.folder, 'homebase-asset.json'));
const sidecarDoorControl = roundSidecar?.controls?.find((control) => control.id === 'door');
check(sidecarDoorControl?.simvar === doorControl?.simvar && sidecarDoorControl?.scope === doorControl?.scope, 'Rundhangar-Sidecar stimmt mit dem instanzlokalen Katalog-Control überein');
const roundXml = fs.readFileSync(path.join(roundModelRoot, 'HomebaseRoundHangar.xml'), 'utf8');
check(roundXml.includes('(L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND, Number)') && roundXml.includes('L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND'), 'Modell-XML enthält objektlokales Tor und globale Beleuchtung');
check(!roundXml.includes('(L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND,'), 'Alte globale Tor-LVar fehlt im Modell-XML');
check(roundXml.includes('<ANIM_LAG>20</ANIM_LAG>'), 'Toranimation verwendet ANIM_LAG = 20');
const roundGltf = path.join(roundModelRoot, 'HomebaseRoundHangar_LOD00.gltf');
const roundBin = path.join(roundModelRoot, 'HomebaseRoundHangar_LOD00.bin');
check(fs.statSync(roundGltf).size > 0 && fs.statSync(roundBin).size > 0, 'Rundhangar-Rohdateien und BIN sind nicht leer');
const roundGltfDocument = readJson(roundGltf);
const roundNodeNames = (roundGltfDocument.nodes || []).map((node) => String(node.name || ''));
check(!roundNodeNames.some((name) => /floor|foundation|apron|drivesurface/i.test(name)), 'Rundhangar-Sichtmodell enthält keinen Boden');
const lightNodes = (roundGltfDocument.nodes || []).filter((node) => node.name === 'RoundHangarLampLight');
const advancedLight = lightNodes[0]?.extensions?.ASOBO_advanced_light;
check(lightNodes.length === 1, 'Rundhangar enthält exakt eine echte Lichtquelle', String(lightNodes.length));
check(advancedLight?.channel_exterior === true && advancedLight?.channel_interior === true, 'Rundhangar-Licht ist für Außen- und Innenkanal freigegeben');
check(lightNodes[0]?.rotation?.[0] > 0.7 && lightNodes[0]?.rotation?.[3] > 0.7, 'Rundhangar-Licht ist nach unten zum Hallenboden ausgerichtet');
const collisionRoot = path.join(dataRoot, 'source', 'ModelLib', roundHangar.collisionProfile.sourceFolder);
check(fs.existsSync(path.join(collisionRoot, 'HomebaseRoundHangarCollision.xml')), 'Zusätzliches ModelLib-Collision-Asset ist vorhanden');
const collisionGltfDocument = readJson(path.join(collisionRoot, 'HomebaseRoundHangarCollision_LOD00.gltf'));
const collisionNodeNames = (collisionGltfDocument.nodes || []).map((node) => String(node.name || ''));
const collisionTags = (collisionGltfDocument.materials || []).flatMap((material) => material.extensions?.ASOBO_tags?.tags || []);
check(!collisionNodeNames.some((name) => /floor|ground|apron|drivesurface/i.test(name)), 'Collision-ModelLib enthält keine Bodenkollision');
check(collisionTags.includes('Collision') && !collisionTags.includes('Ground'), 'Collision-ModelLib enthält nur Collision-, keine Ground-Tags');

const scene = createSceneXml({
  spawn: { lat: 48.1, lon: 11.5, altFt: 100, heading: 10 },
  hangar: { lat: 48.1001, lon: 11.5001, altFt: 100, heightOffsetFt: 0, heading: 10, objectTitle: roundHangar.title },
  objects: [{ id: 'round-deco', title: roundHangar.title, label: 'Rundhangar Deko', lat: 48.1003, lon: 11.5003, altFt: 100, heightOffsetFt: 0, heading: 10, scale: 1 }]
});
check(scene.content.includes('<LibraryObject name="{B90D5EAB-0F9C-4A2A-9917-F57D81E3A24C}"'), 'Homebase-BGL platziert Collision-Gegenstück');
check(!scene.content.includes('VegetationScale'), 'Rundhangar erzeugt ohne Boden kein Vegetationspolygon');
check(!scene.content.includes('FlattenMode'), 'Vegetationspolygon enthält kein FlattenMode');
check(!scene.content.includes('ForceElevation'), 'Vegetationspolygon enthält kein ForceElevation');
check(scene.content.includes('applyFlatten="FALSE"') && scene.content.includes('alt="30.480"'), 'Homebase-Airport- und Spawn-Höhe werden nicht verändert');
check((scene.content.match(/heading="10\.000"/g) || []).length >= 4, 'Haupthangar und Deko verwenden dieselbe sichtbare Heading-Korrektur');

for (const asset of catalog.assets) {
  const assetRoot = path.join(sourceRoot, asset.folder);
  const simCfg = path.join(assetRoot, 'sim.cfg');
  const modelRoot = path.join(assetRoot, 'model');
  check(fs.existsSync(simCfg), `${asset.key}: sim.cfg`);
  check(fs.existsSync(modelRoot), `${asset.key}: model-Ordner`);
  if (!fs.existsSync(simCfg) || !fs.existsSync(modelRoot)) continue;
  const simTitle = fs.readFileSync(simCfg, 'utf8').match(/^title\s*=\s*(.+)$/mi)?.[1]?.trim();
  check(simTitle === asset.title, `${asset.key}: sim.cfg-Titel`, simTitle || 'fehlt');
  const modelCfg = path.join(modelRoot, 'model.cfg');
  check(fs.existsSync(modelCfg), `${asset.key}: model.cfg`);
  const modelFile = fs.existsSync(modelCfg) ? fs.readFileSync(modelCfg, 'utf8').match(/^normal\s*=\s*(.+)$/mi)?.[1]?.trim() : '';
  const xml = path.join(modelRoot, modelFile || '');
  check(Boolean(modelFile) && fs.existsSync(xml), `${asset.key}: XML-Referenz`, modelFile || 'fehlt');
  const gltfs = fs.readdirSync(modelRoot).filter((file) => file.toLowerCase().endsWith('.gltf'));
  check(gltfs.length > 0, `${asset.key}: glTF-Datei`);
  for (const gltfName of gltfs) {
    const gltf = readJson(path.join(modelRoot, gltfName));
    const uri = gltf?.buffers?.[0]?.uri;
    check(Boolean(uri) && fs.existsSync(path.join(modelRoot, uri)), `${asset.key}: glTF-Buffer`, uri || 'fehlt');
  }
}

for (const relative of [
  path.join('SimObjects', 'Misc', roundHangar.folder, 'sim.cfg'),
  path.join('SimObjects', 'Misc', roundHangar.folder, 'homebase-asset.json'),
  path.join('SimObjects', 'Misc', roundHangar.folder, 'model', 'model.cfg'),
  path.join('SimObjects', 'Misc', roundHangar.folder, 'model', 'HomebaseRoundHangar.xml'),
  path.join('SimObjects', 'Misc', roundHangar.folder, 'model', 'HomebaseRoundHangar_LOD00.gltf'),
  path.join('SimObjects', 'Misc', roundHangar.folder, 'model', 'HomebaseRoundHangar_LOD00.bin')
]) {
  const sourceFile = path.join(dataRoot, 'source', relative);
  const seedFile = path.join(seedRoot, 'PackageSources', relative);
  check(fs.existsSync(seedFile) && fs.readFileSync(sourceFile).equals(fs.readFileSync(seedFile)), `Seed ist hashgleich: ${relative}`);
}

const activeChecks = [catalogPath, sourceRoot, path.join(seedRoot, 'catalog.json'), path.join(seedRoot, 'PackageSources')];
for (const target of activeChecks) {
  const haystack = fs.statSync(target).isDirectory() ? files(target).map((file) => fs.readFileSync(file, 'utf8')).join('\n') : fs.readFileSync(target, 'utf8');
  for (const text of banned) check(!haystack.includes(text), `Keine Altbezeichnung in ${path.basename(target)}`, text);
}

const packageRoot = path.join(dataRoot, 'sdk-project', 'Packages', packageName);
const preparedDefinition = path.join(dataRoot, 'sdk-project', 'PackageDefinitions', `${packageName}.xml`);
check(fs.existsSync(preparedDefinition), 'SDK-Paketdefinition vorhanden');
if (fs.existsSync(preparedDefinition)) {
  const definition = fs.readFileSync(preparedDefinition, 'utf8');
  check(definition.includes('<Type>SimObject</Type>'), 'SDK-Projekt verwendet weiterhin das SimObject-Format');
  check(definition.includes('<Type>ArtProj</Type>') && definition.includes('VFRHomebaseRoundHangarCollision'), 'SDK-Projekt enthält zusätzliches ModelLib-Collision-Asset');
}
check(!fs.existsSync(path.join(dataRoot, 'sdk-project', 'PackageSources', 'SimObjects', 'Misc', roundHangar.folder, 'homebase-asset.json')), 'Sidecar wird beim SDK-Staging ausgeschlossen');
check(fs.existsSync(packageRoot), 'SDK-Ausgabeordner', packageRoot);
if (fs.existsSync(packageRoot)) {
  const manifest = readJson(path.join(packageRoot, 'manifest.json'));
  const layout = readJson(path.join(packageRoot, 'layout.json'));
  check(manifest.package_version === version, 'Manifest-Version', manifest.package_version);
  check(Array.isArray(layout.content) && layout.content.length > 0, 'Layout enthält Dateien');
  check(layout.content.some((entry) => /scenery\/.+\.bgl$/i.test(String(entry.path || ''))), 'Kompiliertes Collision-ModelLib-BGL im Paket');
  for (const entry of layout.content || []) {
    const file = path.join(packageRoot, ...String(entry.path).split('/'));
    check(fs.existsSync(file) && fs.statSync(file).size === Number(entry.size), `Layout: ${entry.path}`);
  }
  check(fs.existsSync(path.join(packageRoot, 'SimObjects', 'Misc', 'VFRHomebaseHangar', 'sim.cfg')), 'Gebauter neuer Hangar');
}

const releaseRoot = path.join(dataRoot, 'releases', version);
const indexPath = path.join(releaseRoot, 'package-index.json');
const previewPath = path.join(releaseRoot, 'stable-preview.json');
check(fs.existsSync(indexPath), 'package-index.json lokal vorbereitet');
check(fs.existsSync(previewPath), 'stable-preview.json lokal vorbereitet');
if (fs.existsSync(indexPath)) {
  const index = readJson(indexPath);
  check(index.packageName === packageName, 'Index-Paketname', index.packageName);
  const archive = path.join(releaseRoot, index.fullArchive?.name || '');
  check(!/test/i.test(index.fullArchive?.name || ''), 'Vollarchiv ohne test', index.fullArchive?.name || 'fehlt');
  check(fs.existsSync(archive), 'Vollarchiv vorhanden', archive);
  const roundIndex = index.assets?.find((asset) => asset.key === 'roundHangar');
  check(Boolean(roundIndex?.metadataHash), 'package-index enthält metadataHash');
  check(roundIndex?.headingCorrectionDeg === 0 && roundIndex?.controls?.length === 2, 'package-index erhält Controls und Heading');
  check(Boolean(roundIndex?.collisionProfile && !roundIndex?.vegetationExclusion && roundIndex?.footprint), 'package-index erhält Footprint und Wandkollision, aber keine Vegetationsfläche');
  const roundArchive = path.join(releaseRoot, roundIndex?.archive?.path || '');
  if (fs.existsSync(roundArchive)) {
    const fragment = JSON.parse(execFileSync('tar.exe', ['-xOf', roundArchive, 'asset-fragment.json'], { encoding: 'utf8' }));
    check(fragment.asset?.metadataHash === roundIndex.metadataHash, 'asset-fragment enthält metadataHash');
    check(fragment.asset?.animation?.type === 'door' && fragment.asset?.controls?.length === 2, 'asset-fragment erhält Controls und Legacy-Animation');
    check(fragment.asset?.headingCorrectionDeg === 0 && Boolean(fragment.asset?.collisionProfile && !fragment.asset?.vegetationExclusion && fragment.asset?.footprint), 'asset-fragment erhält Heading, Footprint und Wandkollision, aber keine Vegetationsfläche');
  } else {
    check(false, 'Rundhangar-Assetarchiv vorhanden', roundArchive);
  }
  if (fs.existsSync(archive)) {
    const entries = execFileSync('tar.exe', ['-tf', archive], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    const roots = [...new Set(entries.map((entry) => entry.split('/')[0]).filter(Boolean))];
    check(roots.length === 1 && roots[0] === packageName, 'Vollarchiv hat genau einen Paketroot', roots.join(', '));
  }
}
if (fs.existsSync(previewPath)) check(readJson(previewPath).packageName === packageName, 'Stable-Vorschau-Paketname', readJson(previewPath).packageName);

const report = { ok: failures.length === 0, checks, failures, packageName, version, assetCount: catalog.assets.length, generatedAt: new Date().toISOString() };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
