#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assetCatalog from '../homebase-asset-catalog.js';

const ROOT = process.pkg ? path.dirname(process.execPath) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED_ROOT = path.join(ROOT, 'generated');
const PROJECT = path.join(GENERATED_ROOT, 'vfr-multitool-homebase');
const PROJECT_XML = path.join(PROJECT, 'HomebaseProject.xml');
const PACKAGE_NAME = 'vfr-multitool-homebase';
const LEGACY_PACKAGE_NAME = 'vfr-multitool-homebase-test';
const OUTPUT_PACKAGE = path.join(PROJECT, 'Packages', PACKAGE_NAME);
const PACKAGE_TOOL = process.env.MSFS_PACKAGE_TOOL || 'C:\\MSFS 2024 SDK\\Tools\\bin\\fspackagetool.exe';
const COMMUNITY_PRIMARY = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft Flight Simulator 2024', 'Packages', 'Community');
const COMMUNITY_2024 = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft Flight Simulator 2024', 'Packages', 'Community2024');
const ALLOWED_TITLES = new Set([
  ...assetCatalog.stockObjects.map((entry) => entry.title),
  ...assetCatalog.assets.filter((entry) => entry.kind === 'object' || entry.homebasePlaceable === true).map((entry) => entry.title)
]);
const HANGAR_TITLES = new Set(assetCatalog.assets.filter((entry) => entry.kind === 'hangar').map((entry) => entry.title));
const DEFAULT_HANGAR_TITLE = assetCatalog.assets.find((entry) => entry.key === 'hangar').title;
const GROUND_CLEARANCE_FT = new Map([
  ['Cardboard', 0.3], ['Pallet01_01', 0.08], ['Pallet01_02', 0.08], ['Pallet01_03', 0.08]
]);
const ALTITUDE_STABLE_TITLES = new Set(['Pallet01_01', 'Pallet01_02', 'Pallet01_03']);
const UNIQUE_GUID_ATTRIBUTE = '{359C73E8-06BE-4FB2-ABCB-EC942F7761D0}';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function heading(value) {
  return ((finite(value) % 360) + 360) % 360;
}

function runwayNumber(value) {
  const number = Math.round(heading(value) / 10) || 36;
  return String(Math.min(36, number)).padStart(2, '0');
}

function offsetLatLon(lat, lon, distanceM, bearingDeg) {
  const radiusM = 6378137;
  const angularDistance = distanceM / radiusM;
  const bearing = heading(bearingDeg) * Math.PI / 180;
  const lat1 = lat * Math.PI / 180;
  const lon1 = lon * Math.PI / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance)
      + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );
  return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function xml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function guid() {
  return `{${crypto.randomUUID().toUpperCase()}}`;
}

function catalogEntry(title) {
  return assetCatalog.assets.find((entry) => entry.title === title)
    || assetCatalog.stockObjects.find((entry) => entry.title === title)
    || null;
}

function correctedHeading(item) {
  return heading(item.heading + finite(catalogEntry(item.title)?.headingCorrectionDeg));
}

function normalizeConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Keine gültige Homebase-Konfiguration empfangen.');
  const spawn = input.spawn || {};
  const hangar = input.hangar || {};
  const normalized = {
    protocol: 2,
    name: 'VFR Multitool Homebase',
    warnings: [],
    spawn: {
      lat: finite(spawn.lat, NaN), lon: finite(spawn.lon, NaN), altFt: finite(spawn.altFt),
      heading: heading(spawn.heading), mode: 'airport_parking'
    },
    hangar: {
      lat: finite(hangar.lat, NaN), lon: finite(hangar.lon, NaN), altFt: finite(hangar.altFt),
      heightOffsetFt: finite(hangar.heightOffsetFt), heading: heading(hangar.heading),
      widthM: finite(hangar.widthM, 18), depthM: finite(hangar.depthM, 22),
      objectTitle: HANGAR_TITLES.has(String(hangar.objectTitle || '')) ? String(hangar.objectTitle) : DEFAULT_HANGAR_TITLE
    },
    objects: (Array.isArray(input.objects) ? input.objects : []).map((item, index) => ({
      id: String(item?.id || `object-${index + 1}`), title: String(item?.title || ''), label: String(item?.label || item?.title || `Objekt ${index + 1}`),
      lat: finite(item?.lat, NaN), lon: finite(item?.lon, NaN), altFt: finite(item?.altFt),
      heightOffsetFt: finite(item?.heightOffsetFt), heading: heading(item?.heading),
      scale: Math.min(10, Math.max(0.1, finite(item?.scale, 1)))
    }))
  };
  if (!Number.isFinite(normalized.spawn.lat) || !Number.isFinite(normalized.spawn.lon)) throw new Error('Der Spawnpunkt enthält keine gültigen Koordinaten.');
  if (!Number.isFinite(normalized.hangar.lat) || !Number.isFinite(normalized.hangar.lon)) throw new Error('Der Hangar enthält keine gültigen Koordinaten.');
  if (normalized.objects.length > 100) throw new Error('Maximal 100 Ausstattungsobjekte können gebaut werden.');
  for (const item of normalized.objects) {
    if (!ALLOWED_TITLES.has(item.title)) throw new Error(`Objekttitel ist nicht für den lokalen Paketgenerator freigegeben: ${item.title}`);
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) throw new Error(`${item.label} enthält keine gültigen Koordinaten.`);
  }
  const hangarEntry = catalogEntry(normalized.hangar.objectTitle);
  const collision = hangarEntry?.collisionProfile;
  if (collision?.warnOnHeightOffset && Math.abs(normalized.hangar.heightOffsetFt - finite(collision.defaultHeightOffsetFt)) > 0.005) {
    normalized.warnings.push(`Manuelle Hangarhöhe ${normalized.hangar.heightOffsetFt.toFixed(2)} ft: sichtbares Modell, Spawn und statischer Collider können auseinanderlaufen. Standard ist ${finite(collision.defaultHeightOffsetFt).toFixed(2)} ft.`);
  }
  return normalized;
}

function sceneryObject(item, child) {
  const clearanceFt = GROUND_CLEARANCE_FT.get(item.title) || 0;
  const offsetFt = finite(item.heightOffsetFt) + clearanceFt;
  const offsetM = offsetFt * 0.3048;
  const snap = Math.abs(offsetFt) < 0.005;
  const altitudeStabilizer = ALTITUDE_STABLE_TITLES.has(item.title) ? '    <LowResAltitude/>\n' : '';
  return `  <SceneryObject instanceId="${guid()}" lat="${item.lat.toFixed(8)}" lon="${item.lon.toFixed(8)}" alt="${offsetM.toFixed(3)}" altitudeIsAgl="TRUE" snapToGround="${snap ? 'TRUE' : 'FALSE'}" snapToNormal="FALSE" pitch="0" bank="0" heading="${correctedHeading(item).toFixed(3)}" imageComplexity="VERY_SPARSE">\n${altitudeStabilizer}    ${child}\n  </SceneryObject>`;
}

function collisionObject(item, asset) {
  if (!asset?.collisionProfile?.modelLibGuid) return '';
  return sceneryObject(item, `<LibraryObject name="${xml(asset.collisionProfile.modelLibGuid)}" scale="${finite(item.scale, 1).toFixed(3)}"/>`);
}

function vegetationPolygon(item, asset) {
  const exclusion = asset?.vegetationExclusion;
  if (!exclusion || exclusion.shape !== 'circle') return '';
  const radiusM = finite(exclusion.radiusM);
  const segments = Math.max(12, Math.min(256, Math.trunc(finite(exclusion.segments, 48))));
  if (!(radiusM > 0)) return '';
  const attributes = Array.isArray(exclusion.attributes) && exclusion.attributes.length
    ? exclusion.attributes
    : [
      { name: 'VegetationScale', guid: '{6A043F59-E6F2-4117-A2E4-D510E7317C29}', type: 'UINT32', value: 0 },
      { name: 'VegetationDensity', guid: '{41EFF715-C392-4B31-A457-50A504353A90}', type: 'UINT32', value: 0 },
      { name: 'VegetationFalloff', guid: '{E82ABE17-FB4C-4F67-A28C-ED41969AEAD6}', type: 'FLOAT32', value: finite(exclusion.falloffM, 0.5) }
    ];
  const lines = [`  <Polygon displayName="${xml(`${asset.label || asset.key} Vegetation`)}">`];
  lines.push(`    <Attribute name="UniqueGUID" guid="${UNIQUE_GUID_ATTRIBUTE}" type="GUID" value="${guid()}"/>`);
  for (const attribute of attributes) {
    lines.push(`    <Attribute name="${xml(attribute.name)}" guid="${xml(attribute.guid)}" type="${xml(attribute.type)}" value="${xml(attribute.value)}"/>`);
  }
  for (let index = 0; index < segments; index += 1) {
    const vertex = offsetLatLon(item.lat, item.lon, radiusM, index * 360 / segments);
    lines.push(`    <Vertex lat="${vertex.lat.toFixed(8)}" lon="${vertex.lon.toFixed(8)}"/>`);
  }
  lines.push('  </Polygon>');
  return lines.join('\n');
}

function addAssetPlacement(lines, item, child) {
  const asset = catalogEntry(item.title);
  lines.push(sceneryObject(item, child));
  const collision = collisionObject(item, asset);
  if (collision) lines.push(collision);
  const vegetation = vegetationPolygon(item, asset);
  if (vegetation) lines.push(vegetation);
}

export function createSceneXml(input) {
  const config = normalizeConfig(input);
  const spawnAltM = config.spawn.altFt * 0.3048;
  const lines = ['<?xml version="1.0" encoding="utf-8"?>', '<FSData version="9.0">'];
  // MSFS requires at least one runway for an airport. Keep this technical,
  // transparent runway outside the parking spot and as small as possible so
  // its planar elevation cannot create a mound directly below the spawn.
  const technicalRunway = offsetLatLon(config.spawn.lat, config.spawn.lon, 35, config.spawn.heading + 90);
  lines.push(`  <Airport name="Homebase" ident="VFHB" lat="${config.spawn.lat.toFixed(8)}" lon="${config.spawn.lon.toFixed(8)}" alt="${spawnAltM.toFixed(3)}" altType="GEOID" airportTestRadius="500" applyFlatten="FALSE" starAirport="TRUE">`);
  lines.push(`    <Runway lat="${technicalRunway.lat.toFixed(8)}" lon="${technicalRunway.lon.toFixed(8)}" alt="${spawnAltM.toFixed(3)}" altType="GEOID" surface="UNKNOWN" transparent="TRUE" heading="${config.spawn.heading.toFixed(3)}" length="1" width="1" number="${runwayNumber(config.spawn.heading)}" designator="NONE" groundMerging="FALSE" excludeVegetationAround="FALSE" excludeBuildingAround="FALSE">`);
  lines.push('    </Runway>');
  lines.push(`    <TaxiwayParking index="0" type="RAMP_GA_SMALL" name="PARKING" number="1" radius="7.6" heading="${config.spawn.heading.toFixed(3)}" lat="${config.spawn.lat.toFixed(8)}" lon="${config.spawn.lon.toFixed(8)}"/>`);
  lines.push('  </Airport>');
  addAssetPlacement(lines, { ...config.hangar, title: config.hangar.objectTitle, scale: 1 }, `<SimObject containerTitle="${xml(config.hangar.objectTitle)}" scale="1.000"/>`);
  for (const item of config.objects) {
    if (item.title === 'Windsock') {
      addAssetPlacement(lines, item, '<Windsock poleHeight="5.000" sockLength="2.500" lighted="TRUE" containerTitle="Windsock"/>');
    } else {
      addAssetPlacement(lines, item, `<SimObject containerTitle="${xml(item.title)}" scale="${item.scale.toFixed(3)}"/>`);
    }
  }
  lines.push('</FSData>', '');
  return { config, content: lines.join('\n') };
}

function projectXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<Project Version="2" Name="VFR-Multitool-Homebase" FolderName="Packages" MetadataFolderName="PackagesMetadata">\n  <OutputDirectory>.</OutputDirectory>\n  <TemporaryOutputDirectory>_PackageInt</TemporaryOutputDirectory>\n  <Packages><Package>PackageDefinitions\\${PACKAGE_NAME}.xml</Package></Packages>\n  <PublishingGroups/>\n</Project>\n`;
}

function packageXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<AssetPackage Version="0.4.2">\n  <PackageOrderHint>CUSTOM_AIRPORT</PackageOrderHint>\n  <ItemSettings>\n    <ContentType>SCENERY</ContentType>\n    <Title>VFR Multitool Homebase</Title>\n    <Creator>VFR Multitool</Creator>\n    <Description>Generated Homebase scenery by VFR Multitool. Requires the VFR Multitool Homebase asset package.</Description>\n  </ItemSettings>\n  <Flags><VisibleInStore>false</VisibleInStore><CanBeReferenced>false</CanBeReferenced></Flags>\n  <AssetGroups>\n    <AssetGroup Name="homebase-scenery">\n      <Type>BGL</Type>\n      <Flags><FSXCompatibility>false</FSXCompatibility></Flags>\n      <AssetDir>PackageSources\\scenery</AssetDir>\n      <OutputDir>Scenery\\${PACKAGE_NAME}\\Scenery</OutputDir>\n    </AssetGroup>\n  </AssetGroups>\n</AssetPackage>\n`;
}

export async function prepareSceneProject(input) {
  const { config, content } = createSceneXml(input);
  const resolved = path.resolve(PROJECT);
  if (!resolved.startsWith(`${path.resolve(GENERATED_ROOT)}${path.sep}`)) throw new Error('Unsicherer Projektpfad wurde abgewiesen.');
  await fs.rm(PROJECT, { recursive: true, force: true });
  await fs.mkdir(path.join(PROJECT, 'PackageDefinitions'), { recursive: true });
  await fs.mkdir(path.join(PROJECT, 'PackageSources', 'scenery'), { recursive: true });
  await fs.writeFile(PROJECT_XML, projectXml(), 'utf8');
  const packageContent = packageXml().replace('<AssetPackage Version="0.4.2">', '<AssetPackage Version="0.5.0">');
  await fs.writeFile(path.join(PROJECT, 'PackageDefinitions', `${PACKAGE_NAME}.xml`), packageContent, 'utf8');
  await fs.writeFile(path.join(PROJECT, 'PackageSources', 'scenery', 'homebase.xml'), content, 'utf8');
  await fs.writeFile(path.join(PROJECT, 'homebase-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  const diagnostic = `@echo off\r\ntitle VFR Multitool Homebase - SDK Diagnose\r\n"${PACKAGE_TOOL}" "${PROJECT_XML}" -outputdir "${PROJECT}" -tempdir "${PROJECT}" -rebuild -forcesteam -nopause\r\necho Package-Tool Exit-Code: %ERRORLEVEL%\r\npause\r\n`;
  await fs.writeFile(path.join(PROJECT, 'build-sdk-diagnostic.cmd'), diagnostic, 'utf8');
  return { message: `SDK-Projekt mit Hangar und ${config.objects.length} Objekt(en) erzeugt.`, path: PROJECT, objectCount: config.objects.length, warnings: config.warnings };
}

export function isSimulatorRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const output = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq FlightSimulator2024.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
    return output.toLowerCase().includes('flightsimulator2024.exe');
  } catch (_) {
    return false;
  }
}

export async function inspectPackageTool() {
  try {
    await fs.access(PACKAGE_TOOL);
    return { installed: true, path: PACKAGE_TOOL };
  } catch (_) {
    return {
      installed: false,
      path: PACKAGE_TOOL,
      help: 'Installiere das MSFS 2024 SDK über den Entwicklermodus. Das Package Tool wird benötigt, um die XML-Szene in eine BGL-Datei für MSFS umzuwandeln.'
    };
  }
}

function runPackageTool(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(PACKAGE_TOOL, args, { cwd: PROJECT, windowsHide: false });
    let output = '';
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.stderr?.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, output }));
  });
}

export async function buildScenePackage(input) {
  if (isSimulatorRunning()) {
    const error = new Error('MSFS läuft noch. Für den externen SDK-Build bitte zuerst den normalen Simulator schließen.');
    error.code = 'SIM_RUNNING';
    throw error;
  }
  const sdk = await inspectPackageTool();
  if (!sdk.installed) {
    const error = new Error(`MSFS Package Tool nicht gefunden: ${PACKAGE_TOOL}`);
    error.code = 'SDK_MISSING';
    error.help = sdk.help;
    throw error;
  }
  await prepareSceneProject(input);
  const args = [PROJECT_XML, '-outputdir', PROJECT, '-tempdir', PROJECT, '-rebuild', '-forcesteam', '-nopause'];
  const result = await runPackageTool(args);
  await fs.writeFile(path.join(PROJECT, 'last-build.log'), `Tool: ${PACKAGE_TOOL}\nArgs: ${args.join(' ')}\nExit: ${result.code}\n\n${result.output}`, 'utf8');
  if (result.code !== 0) throw new Error(`Package Tool wurde mit Exit-Code ${result.code} beendet. Siehe last-build.log.`);
  try {
    await fs.access(path.join(OUTPUT_PACKAGE, 'manifest.json'));
    await fs.access(path.join(OUTPUT_PACKAGE, 'layout.json'));
  } catch (_) {
    throw new Error('Das Package Tool meldete Erfolg, aber manifest.json/layout.json fehlen.');
  }
  return { message: 'Homebase-Szenenpaket wurde mit dem offiziellen SDK gebaut.', path: OUTPUT_PACKAGE };
}

export async function installScenePackage() {
  if (isSimulatorRunning()) {
    const error = new Error('MSFS läuft noch. Vor der Installation in den Community-Ordner bitte den Simulator schließen.');
    error.code = 'SIM_RUNNING';
    throw error;
  }
  try {
    await fs.access(path.join(OUTPUT_PACKAGE, 'manifest.json'));
    await fs.access(path.join(OUTPUT_PACKAGE, 'layout.json'));
  } catch (_) {
    throw new Error('Noch kein vollständig gebautes Szenenpaket vorhanden. Zuerst „Mit SDK bauen“ ausführen.');
  }
  const target = path.join(COMMUNITY_PRIMARY, PACKAGE_NAME);
  const legacyTarget = path.join(COMMUNITY_PRIMARY, LEGACY_PACKAGE_NAME);
  if (!path.resolve(target).startsWith(`${path.resolve(COMMUNITY_PRIMARY)}${path.sep}`)) throw new Error('Unsicherer Community-Zielpfad wurde abgewiesen.');
  await fs.mkdir(COMMUNITY_PRIMARY, { recursive: true });
  await fs.rm(target, { recursive: true, force: true });
  await fs.rm(legacyTarget, { recursive: true, force: true });
  await fs.cp(OUTPUT_PACKAGE, target, { recursive: true, force: true });
  for (const staleRoot of [COMMUNITY_2024]) {
    await fs.rm(path.join(staleRoot, PACKAGE_NAME), { recursive: true, force: true });
    await fs.rm(path.join(staleRoot, LEGACY_PACKAGE_NAME), { recursive: true, force: true });
  }
  return { message: 'Homebase-Mod wurde sauber in den aktiven Community-Ordner installiert; alte Paketkopien wurden entfernt.', path: target };
}

export async function uninstallScenePackage() {
  const removed = [];
  for (const communityRoot of [COMMUNITY_PRIMARY, COMMUNITY_2024]) {
    for (const packageName of [PACKAGE_NAME, LEGACY_PACKAGE_NAME]) {
      const target = path.join(communityRoot, packageName);
      const resolvedRoot = path.resolve(communityRoot);
      const resolvedTarget = path.resolve(target);
      if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Unsicherer Community-Zielpfad wurde abgewiesen.');
      try {
        await fs.access(target);
      } catch (_) {
        continue;
      }
      await fs.rm(target, { recursive: true, force: true });
      removed.push(target);
    }
  }
  if (!removed.length) {
    return { message: 'Homebase war in den Community-Ordnern nicht installiert. Es musste nichts gelöscht werden.', removedPaths: [] };
  }
  return {
    message: `Homebase wurde aus ${removed.length === 1 ? 'dem Community-Ordner' : 'den Community-Ordnern'} gelöscht. Starte MSFS neu, damit die Änderung wirksam wird.`,
    removedPaths: removed
  };
}
