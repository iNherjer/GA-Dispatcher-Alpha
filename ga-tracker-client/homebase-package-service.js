'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const catalog = require('./homebase-asset-catalog.js');
const { compareVersions, createHomebaseAssetUpdater } = require('./homebase-asset-updater.js');

// The MSFS package schema accepts a numeric dotted version here. The test
// identity belongs in the tracker/build filename, not in AssetPackage.Version.
const SCENE_PACKAGE_VERSION = '0.5.0';
const DEFAULT_ASSET_CHANNEL_URL = 'https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/homebase/assets/channel/stable.json';
const ALLOWED_OBJECT_TITLES = new Set([
  ...catalog.stockObjects.map((entry) => entry.title),
  ...catalog.assets.filter((entry) => entry.kind === 'object').map((entry) => entry.title)
]);
const HANGAR_TITLES = new Set(catalog.assets.filter((entry) => entry.kind === 'hangar').map((entry) => entry.title));
const DEFAULT_HANGAR = catalog.assets.find((entry) => entry.key === 'hangar')?.title;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function heading(value) {
  return ((finite(value) % 360) + 360) % 360;
}

function xml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function guid() {
  return `{${crypto.randomUUID().toUpperCase()}}`;
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

function runwayNumber(value) {
  const number = Math.round(heading(value) / 10) || 36;
  return String(Math.min(36, number)).padStart(2, '0');
}

function normalizeConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Keine gültige Homebase-Konfiguration empfangen.');
  const spawn = input.spawn || {};
  const hangar = input.hangar || {};
  const normalized = {
    protocol: 2,
    name: 'VFR Multitool Homebase',
    spawn: {
      lat: finite(spawn.lat, NaN),
      lon: finite(spawn.lon, NaN),
      altFt: finite(spawn.altFt),
      heading: heading(spawn.heading),
      mode: 'airport_parking'
    },
    hangar: {
      lat: finite(hangar.lat, NaN),
      lon: finite(hangar.lon, NaN),
      altFt: finite(hangar.altFt),
      heightOffsetFt: Math.max(-20, Math.min(200, finite(hangar.heightOffsetFt))),
      heading: heading(hangar.heading),
      widthM: finite(hangar.widthM, 18),
      depthM: finite(hangar.depthM, 22),
      objectTitle: (() => {
        const title = String(hangar.objectTitle || '');
        const definition = catalog.objectDefinitionForTitle(title);
        return HANGAR_TITLES.has(title) || (definition?.runtimeAsset === true && definition.kind === 'hangar') ? title : DEFAULT_HANGAR;
      })()
    },
    objects: (Array.isArray(input.objects) ? input.objects : []).slice(0, 100).map((item, index) => ({
      id: String(item?.id || `object-${index + 1}`),
      title: String(item?.title || ''),
      label: String(item?.label || item?.title || `Objekt ${index + 1}`),
      lat: finite(item?.lat, NaN),
      lon: finite(item?.lon, NaN),
      altFt: finite(item?.altFt),
      heightOffsetFt: Math.max(-20, Math.min(200, finite(item?.heightOffsetFt))),
      heading: heading(item?.heading),
      scale: Math.max(0.1, Math.min(10, finite(item?.scale, 1)))
    }))
  };
  if (!Number.isFinite(normalized.spawn.lat) || !Number.isFinite(normalized.spawn.lon)) throw new Error('Der Spawnpunkt enthält keine gültigen Koordinaten.');
  if (!Number.isFinite(normalized.hangar.lat) || !Number.isFinite(normalized.hangar.lon)) throw new Error('Der Hangar enthält keine gültigen Koordinaten.');
  for (const item of normalized.objects) {
    const definition = catalog.objectDefinitionForTitle(item.title);
    if (!ALLOWED_OBJECT_TITLES.has(item.title) && !(definition?.runtimeAsset === true && definition.kind === 'object')) {
      throw new Error(`Objekttitel ist nicht für den Paketgenerator freigegeben: ${item.title}`);
    }
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) throw new Error(`${item.label} enthält keine gültigen Koordinaten.`);
  }
  return normalized;
}

function sceneryObject(item, title, child) {
  const meta = catalog.objectDefinitionForTitle(title) || {};
  const offsetFt = finite(item.heightOffsetFt) + finite(meta.groundClearanceFt);
  const offsetM = offsetFt * 0.3048;
  const snap = Math.abs(offsetFt) < 0.005;
  const altitudeStabilizer = meta.lowResAltitude === true ? '    <LowResAltitude/>\n' : '';
  return `  <SceneryObject instanceId="${guid()}" lat="${item.lat.toFixed(8)}" lon="${item.lon.toFixed(8)}" alt="${offsetM.toFixed(3)}" altitudeIsAgl="TRUE" snapToGround="${snap ? 'TRUE' : 'FALSE'}" snapToNormal="FALSE" pitch="0" bank="0" heading="${heading(item.heading).toFixed(3)}" imageComplexity="VERY_SPARSE">\n${altitudeStabilizer}    ${child}\n  </SceneryObject>`;
}

function createSceneXml(input) {
  const config = normalizeConfig(input);
  const spawnAltM = config.spawn.altFt * 0.3048;
  const technicalRunway = offsetLatLon(config.spawn.lat, config.spawn.lon, 35, config.spawn.heading + 90);
  const lines = ['<?xml version="1.0" encoding="utf-8"?>', '<FSData version="9.0">'];
  lines.push(`  <Airport name="Homebase" ident="VFHB" lat="${config.spawn.lat.toFixed(8)}" lon="${config.spawn.lon.toFixed(8)}" alt="${spawnAltM.toFixed(3)}" altType="GEOID" airportTestRadius="500" applyFlatten="FALSE" starAirport="TRUE">`);
  lines.push(`    <Runway lat="${technicalRunway.lat.toFixed(8)}" lon="${technicalRunway.lon.toFixed(8)}" alt="${spawnAltM.toFixed(3)}" altType="GEOID" surface="UNKNOWN" transparent="TRUE" heading="${config.spawn.heading.toFixed(3)}" length="1" width="1" number="${runwayNumber(config.spawn.heading)}" designator="NONE" groundMerging="FALSE" excludeVegetationAround="FALSE" excludeBuildingAround="FALSE"></Runway>`);
  lines.push(`    <TaxiwayParking index="0" type="RAMP_GA_SMALL" name="PARKING" number="1" radius="7.6" heading="${config.spawn.heading.toFixed(3)}" lat="${config.spawn.lat.toFixed(8)}" lon="${config.spawn.lon.toFixed(8)}"/>`);
  lines.push('  </Airport>');
  lines.push(sceneryObject(config.hangar, config.hangar.objectTitle, `<SimObject containerTitle="${xml(config.hangar.objectTitle)}" scale="1.000"/>`));
  for (const item of config.objects) {
    if (item.title === 'Windsock') {
      lines.push(sceneryObject(item, item.title, '<Windsock poleHeight="5.000" sockLength="2.500" lighted="TRUE" containerTitle="Windsock"/>'));
    } else {
      lines.push(sceneryObject(item, item.title, `<SimObject containerTitle="${xml(item.title)}" scale="${item.scale.toFixed(3)}"/>`));
    }
  }
  lines.push('</FSData>', '');
  return { config, content: lines.join('\n') };
}

function tasklistHasSimulatorProcess(output) {
  return String(output || '').split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const csvImageName = trimmed.match(/^"([^"]+)"/i)?.[1];
    const imageName = csvImageName || trimmed.split(/\s+/)[0];
    return String(imageName || '').toLowerCase() === 'flightsimulator2024.exe';
  });
}

function isSimulatorRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const output = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq FlightSimulator2024.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
    return tasklistHasSimulatorProcess(output);
  } catch (_) {
    return false;
  }
}

function validateLayoutPackage(root) {
  const manifestPath = path.join(root, 'manifest.json');
  const layoutPath = path.join(root, 'layout.json');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(layoutPath)) throw new Error(`Unvollständiges Paket: ${root}`);
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
  for (const entry of Array.isArray(layout.content) ? layout.content : []) {
    const file = path.join(root, ...String(entry.path || '').split('/'));
    if (!fs.existsSync(file)) throw new Error(`Layout-Datei fehlt: ${entry.path}`);
    if (Number(fs.statSync(file).size) !== Number(entry.size)) throw new Error(`Layout-Größe stimmt nicht: ${entry.path}`);
  }
  return { manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')), layout };
}

function copyRecursive(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // process.pkg exposes embedded assets through a read-only virtual filesystem.
  // readFile/writeFile works reliably when the target is a real Community folder.
  fs.writeFileSync(target, fs.readFileSync(source));
}

async function waitForSimulatorExit(isRunning, options = {}) {
  const maxChecks = Math.max(1, Math.min(60, Math.round(Number(options.maxChecks) || 16)));
  const delayMs = Math.max(0, Math.min(10000, Math.round(Number(options.delayMs) || 2000)));
  const wait = typeof options.wait === 'function' ? options.wait : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : () => {};
  for (let check = 1; check <= maxChecks; check += 1) {
    if (!isRunning()) return { checks: check, retries: check - 1, waitedMs: (check - 1) * delayMs };
    if (check >= maxChecks) break;
    onRetry({ retry: check, maxRetries: maxChecks - 1, delayMs });
    await wait(delayMs);
  }
  const waitedSeconds = Math.round(((maxChecks - 1) * delayMs) / 1000);
  const error = new Error(`MSFS läuft nach ${waitedSeconds} Sekunden noch. Der SDK-Build wurde sicher pausiert; bitte MSFS vollständig schließen und erneut starten.`);
  error.code = 'SIM_RUNNING';
  error.checks = maxChecks;
  error.waitedMs = (maxChecks - 1) * delayMs;
  throw error;
}

function createHomebasePackageService(options = {}) {
  const runtimeDir = path.resolve(options.runtimeDir || process.cwd());
  const sendAck = typeof options.sendAck === 'function' ? options.sendAck : () => {};
  const log = typeof options.log === 'function' ? options.log : () => {};
  const simulatorRunning = typeof options.isSimulatorRunning === 'function' ? options.isSimulatorRunning : isSimulatorRunning;
  const appData = options.appData || process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const communityPrimary = path.join(appData, 'Microsoft Flight Simulator 2024', 'Packages', 'Community');
  const community2024 = path.join(appData, 'Microsoft Flight Simulator 2024', 'Packages', 'Community2024');
  const embeddedAssetPackage = path.resolve(
    options.embeddedAssetPackagePath
      || path.join(__dirname, 'embedded-homebase-assets', catalog.assetPackageName)
  );
  const project = path.join(runtimeDir, 'homebase-generated', 'vfr-multitool-homebase');
  const projectXmlPath = path.join(project, 'HomebaseProject.xml');
  const outputPackage = path.join(project, 'Packages', catalog.scenePackageName);
  const packageTool = process.env.MSFS_PACKAGE_TOOL || 'C:\\MSFS 2024 SDK\\Tools\\bin\\fspackagetool.exe';
  const assetCacheRoot = path.join(runtimeDir, 'homebase-asset-cache');
  const assetChannelUrl = options.assetChannelUrl || process.env.VFR_HOMEBASE_ASSET_CHANNEL_URL || DEFAULT_ASSET_CHANNEL_URL;
  const simulatorExitMaxChecks = Math.max(1, Math.min(60, Math.round(Number(options.simulatorExitMaxChecks) || 60)));
  const simulatorExitRetryDelayMs = Math.max(0, Math.min(10000, Math.round(Number(options.simulatorExitRetryDelayMs) || 2000)));
  const simulatorExitWait = typeof options.simulatorExitWait === 'function' ? options.simulatorExitWait : undefined;
  let queue = Promise.resolve();
  let remoteUpdater = null;

  const activeAssetIndexPath = path.join(assetCacheRoot, 'active-package-index.json');
  const readActiveAssetCatalog = (installed = inspectAssets()) => {
    try {
      const index = JSON.parse(fs.readFileSync(activeAssetIndexPath, 'utf8'));
      if (index?.packageName !== catalog.assetPackageName || index?.packageVersion !== installed.packageVersion || !installed.packageComplete) return [];
      const assets = Array.isArray(index.assets) ? index.assets : [];
      catalog.registerRuntimeAssets(assets);
      return assets.map((asset) => ({
        key: String(asset?.key || ''), folder: String(asset?.folder || ''), title: String(asset?.title || ''),
        label: String(asset?.label || ''), version: String(asset?.version || ''), kind: String(asset?.kind || ''),
        group: String(asset?.group || ''), missionSpawnable: asset?.missionSpawnable === true,
        missionTags: Array.isArray(asset?.missionTags) ? asset.missionTags.map(String).slice(0, 20) : [],
        missionRoles: Array.isArray(asset?.missionRoles) ? asset.missionRoles.map(String).slice(0, 20) : []
      }));
    } catch (_) {
      return [];
    }
  };

  const ack = (command, suffix, payload = {}) => sendAck({
    type: `homebase_v1.${suffix}_ack`,
    commandId: command?.commandId || null,
    ...payload
  });

  const status = () => ({
    installed: fs.existsSync(packageTool),
    sdkInstalled: fs.existsSync(packageTool),
    sdkPath: packageTool,
    simulatorRunning: simulatorRunning(),
    built: fs.existsSync(path.join(outputPackage, 'manifest.json')) && fs.existsSync(path.join(outputPackage, 'layout.json')),
    outputPath: outputPackage
  });

  const prepare = (rawConfig) => {
    const { config, content } = createSceneXml(rawConfig);
    const generatedRoot = path.join(runtimeDir, 'homebase-generated');
    const relative = path.relative(generatedRoot, project);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsicherer Homebase-Projektpfad.');
    fs.rmSync(project, { recursive: true, force: true });
    fs.mkdirSync(path.join(project, 'PackageDefinitions'), { recursive: true });
    fs.mkdirSync(path.join(project, 'PackageSources', 'scenery'), { recursive: true });
    const projectXml = `<?xml version="1.0" encoding="utf-8"?>\n<Project Version="2" Name="VFR-Multitool-Homebase" FolderName="Packages" MetadataFolderName="PackagesMetadata">\n  <OutputDirectory>.</OutputDirectory>\n  <TemporaryOutputDirectory>_PackageInt</TemporaryOutputDirectory>\n  <Packages><Package>PackageDefinitions\\${catalog.scenePackageName}.xml</Package></Packages>\n  <PublishingGroups/>\n</Project>\n`;
    const packageXml = `<?xml version="1.0" encoding="utf-8"?>\n<AssetPackage Version="${SCENE_PACKAGE_VERSION}">\n  <PackageOrderHint>CUSTOM_AIRPORT</PackageOrderHint>\n  <ItemSettings>\n    <ContentType>SCENERY</ContentType>\n    <Title>VFR Multitool Homebase</Title>\n    <Creator>VFR Multitool</Creator>\n    <Description>Generated Homebase scenery by VFR Multitool.</Description>\n  </ItemSettings>\n  <Flags><VisibleInStore>false</VisibleInStore><CanBeReferenced>false</CanBeReferenced></Flags>\n  <AssetGroups>\n    <AssetGroup Name="homebase-scenery">\n      <Type>BGL</Type>\n      <Flags><FSXCompatibility>false</FSXCompatibility></Flags>\n      <AssetDir>PackageSources\\scenery</AssetDir>\n      <OutputDir>Scenery\\${catalog.scenePackageName}\\Scenery</OutputDir>\n    </AssetGroup>\n  </AssetGroups>\n</AssetPackage>\n`;
    fs.writeFileSync(projectXmlPath, projectXml, 'utf8');
    fs.writeFileSync(path.join(project, 'PackageDefinitions', `${catalog.scenePackageName}.xml`), packageXml, 'utf8');
    fs.writeFileSync(path.join(project, 'PackageSources', 'scenery', 'homebase.xml'), content, 'utf8');
    fs.writeFileSync(path.join(project, 'homebase-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return { path: project, objectCount: config.objects.length };
  };

  const runPackageTool = () => new Promise((resolve, reject) => {
    const args = [projectXmlPath, '-outputdir', project, '-tempdir', project, '-rebuild', '-forcesteam', '-nopause'];
    const child = spawn(packageTool, args, { cwd: project, windowsHide: false });
    let output = '';
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.stderr?.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, output, args }));
  });

  const build = async (rawConfig) => {
    const simulatorExit = await waitForSimulatorExit(simulatorRunning, {
      maxChecks: simulatorExitMaxChecks,
      delayMs: simulatorExitRetryDelayMs,
      wait: simulatorExitWait,
      onRetry({ retry, maxRetries, delayMs }) {
        log(`HOMEBASE_SIM_EXIT_WAIT retry=${retry}/${maxRetries} delayMs=${delayMs}`);
      }
    });
    log(`HOMEBASE_SIM_EXIT_CONFIRMED checks=${simulatorExit.checks} waitedMs=${simulatorExit.waitedMs}`);
    if (!fs.existsSync(packageTool)) {
      const error = new Error(`MSFS Package Tool nicht gefunden: ${packageTool}`);
      error.code = 'SDK_MISSING';
      throw error;
    }
    prepare(rawConfig);
    const result = await runPackageTool();
    fs.writeFileSync(path.join(project, 'last-build.log'), `Tool: ${packageTool}\nArgs: ${result.args.join(' ')}\nExit: ${result.code}\n\n${result.output}`, 'utf8');
    if (result.code !== 0) throw new Error(`Package Tool wurde mit Exit-Code ${result.code} beendet.`);
    validateLayoutPackage(outputPackage);
    return { path: outputPackage, logPath: path.join(project, 'last-build.log'), simulatorExit };
  };

  const assertCommunityChild = (target, root) => {
    const relative = path.relative(path.resolve(root), path.resolve(target));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Unsicherer Community-Zielpfad: ${target}`);
  };

  const install = () => {
    if (simulatorRunning()) {
      const error = new Error('MSFS läuft noch. Vor der Installation bitte den Simulator schließen.');
      error.code = 'SIM_RUNNING';
      throw error;
    }
    validateLayoutPackage(outputPackage);
    const target = path.join(communityPrimary, catalog.scenePackageName);
    const staging = path.join(communityPrimary, `${catalog.scenePackageName}.__staging`);
    const backup = path.join(communityPrimary, `${catalog.scenePackageName}.__backup`);
    assertCommunityChild(target, communityPrimary);
    assertCommunityChild(staging, communityPrimary);
    assertCommunityChild(backup, communityPrimary);
    fs.mkdirSync(communityPrimary, { recursive: true });
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(backup, { recursive: true, force: true });
    copyRecursive(outputPackage, staging);
    validateLayoutPackage(staging);
    let previousMoved = false;
    try {
      if (fs.existsSync(target)) {
        fs.renameSync(target, backup);
        previousMoved = true;
      }
      fs.renameSync(staging, target);
      validateLayoutPackage(target);
      fs.rmSync(backup, { recursive: true, force: true });
    } catch (error) {
      fs.rmSync(target, { recursive: true, force: true });
      if (previousMoved && fs.existsSync(backup)) fs.renameSync(backup, target);
      fs.rmSync(staging, { recursive: true, force: true });
      throw new Error(`Homebase-Installation zurückgerollt: ${error?.message || error}`);
    }
    for (const stale of [path.join(community2024, catalog.scenePackageName)]) {
      try { fs.rmSync(stale, { recursive: true, force: true }); } catch (_) {}
    }
    return { path: target };
  };

  const uninstall = () => {
    const removedPaths = [];
    for (const root of [communityPrimary, community2024]) {
      for (const name of [catalog.scenePackageName]) {
        const target = path.join(root, name);
        assertCommunityChild(target, root);
        if (!fs.existsSync(target)) continue;
        fs.rmSync(target, { recursive: true, force: true });
        removedPaths.push(target);
      }
    }
    return { removedPaths };
  };

  const inspectAssetPackage = (packagePath, expectations = {}) => {
    const { manifest, layout } = validateLayoutPackage(packagePath);
    const paths = new Set((layout.content || []).map((entry) => String(entry.path || '').toLowerCase()));
    const requiredAssets = Array.isArray(expectations.assets) ? expectations.assets : catalog.assets;
    const filesComplete = requiredAssets.every((entry) => paths.has(`simobjects/misc/${String(entry.folder || '').toLowerCase()}/sim.cfg`));
    const packageVersion = String(manifest.package_version || '');
    const expectedVersion = String(expectations.packageVersion || '');
    const versionMatches = !expectedVersion || packageVersion === expectedVersion;
    return {
      packagePath,
      packageComplete: filesComplete && versionMatches,
      packageFilesComplete: filesComplete,
      packageVersion,
      expectedPackageVersion: expectedVersion || catalog.assetPackageVersion,
      packageVersionMatches: versionMatches,
      assetCount: requiredAssets.length
    };
  };

  const inspectEmbeddedAssets = () => {
    try {
      const result = inspectAssetPackage(embeddedAssetPackage, { packageVersion: catalog.assetPackageVersion, assets: catalog.assets });
      return {
        embeddedAvailable: true,
        embeddedPath: embeddedAssetPackage,
        embeddedPackageComplete: result.packageComplete,
        embeddedPackageVersion: result.packageVersion,
        embeddedError: ''
      };
    } catch (error) {
      return {
        embeddedAvailable: false,
        embeddedPath: embeddedAssetPackage,
        embeddedPackageComplete: false,
        embeddedPackageVersion: '',
        embeddedError: error?.message || String(error)
      };
    }
  };

  const inspectAssets = () => {
    let fallback = null;
    for (const root of [communityPrimary, community2024]) {
      const packagePath = path.join(root, catalog.assetPackageName);
      if (!fs.existsSync(packagePath)) continue;
      try {
        const result = { communityFound: true, communityPath: root, ...inspectAssetPackage(packagePath) };
        if (result.packageComplete) return result;
        if (!fallback) fallback = result;
      } catch (error) {
        if (!fallback) {
          fallback = {
            communityFound: true,
            communityPath: root,
            packagePath,
            packageComplete: false,
            packageFilesComplete: false,
            packageVersion: '',
            expectedPackageVersion: catalog.assetPackageVersion,
            assetCount: catalog.assets.length,
            packageError: error?.message || String(error)
          };
        }
      }
    }
    return fallback || {
      communityFound: false,
      packageComplete: false,
      packageFilesComplete: false,
      packageVersion: '',
      expectedPackageVersion: catalog.assetPackageVersion,
      assetCount: catalog.assets.length
    };
  };

  remoteUpdater = createHomebaseAssetUpdater({
    packageName: catalog.assetPackageName,
    channelUrl: assetChannelUrl,
    cacheRoot: assetCacheRoot,
    requiredAssets: catalog.assets,
    requestBuffer: options.remoteRequestBuffer,
    allowHttpForTests: options.allowHttpForTests === true,
    cacheTtlMs: options.remoteCacheTtlMs,
    onProgress(progress = {}) {
      sendAck({
        type: 'homebase_v1.assets.update.progress',
        commandId: null,
        status: 'progress',
        phase: progress.phase || '',
        message: progress.message || '',
        remoteVersion: progress.remoteVersion || ''
      });
    }
  });

  const inspectAssetState = () => {
    const installed = inspectAssets();
    return { ...installed, ...inspectEmbeddedAssets(), ...remoteUpdater.snapshot(installed), assetCatalog: readActiveAssetCatalog(installed) };
  };

  const atomicallyInstallAssetPackage = (sourcePackage, expectedVersion, installOptions = {}) => {
    const source = inspectAssetPackage(sourcePackage, { packageVersion: expectedVersion, assets: catalog.assets });
    if (!source.packageComplete) throw new Error(`Assetquelle ${expectedVersion} ist unvollständig oder hat die falsche Version.`);
    const target = path.join(communityPrimary, catalog.assetPackageName);
    const staging = path.join(communityPrimary, `${catalog.assetPackageName}.__staging`);
    const backup = path.join(communityPrimary, `${catalog.assetPackageName}.__backup`);
    assertCommunityChild(target, communityPrimary);
    assertCommunityChild(staging, communityPrimary);
    assertCommunityChild(backup, communityPrimary);
    fs.mkdirSync(communityPrimary, { recursive: true });
    fs.rmSync(staging, { recursive: true, force: true });
    if (!fs.existsSync(target) && fs.existsSync(backup)) {
      fs.renameSync(backup, target);
      log(`HOMEBASE_ASSETS_RECOVERED path="${target}"`);
    } else {
      fs.rmSync(backup, { recursive: true, force: true });
    }
    const previous = inspectAssets();
    const sameTarget = path.resolve(previous.packagePath || '') === path.resolve(target);
    if (installOptions.skipIfSameOrNewer && previous.packageComplete && sameTarget && compareVersions(previous.packageVersion, expectedVersion) >= 0) {
      return { path: target, packageVersion: previous.packageVersion, unchanged: true, previousVersion: previous.packageVersion, source: installOptions.source || 'embedded' };
    }
    copyRecursive(sourcePackage, staging);
    const staged = inspectAssetPackage(staging, { packageVersion: expectedVersion, assets: catalog.assets });
    if (!staged.packageComplete) throw new Error(`Vorbereitete Assetversion ${staged.packageVersion || '(ohne Version)'} ist unvollständig.`);
    let previousMoved = false;
    try {
      if (fs.existsSync(target)) {
        fs.renameSync(target, backup);
        previousMoved = true;
      }
      fs.renameSync(staging, target);
      const installed = inspectAssetPackage(target, { packageVersion: expectedVersion, assets: catalog.assets });
      if (!installed.packageComplete) throw new Error('Installiertes Assetpaket konnte nicht vollständig validiert werden.');
      fs.rmSync(backup, { recursive: true, force: true });
    } catch (error) {
      fs.rmSync(target, { recursive: true, force: true });
      if (previousMoved && fs.existsSync(backup)) fs.renameSync(backup, target);
      fs.rmSync(staging, { recursive: true, force: true });
      throw new Error(`Asset-Installation zurückgerollt: ${error?.message || error}`);
    }
    const stale = path.join(community2024, catalog.assetPackageName);
    if (path.resolve(stale) !== path.resolve(target)) {
      try { fs.rmSync(stale, { recursive: true, force: true }); } catch (_) {}
    }
    log(`HOMEBASE_ASSETS_INSTALLED source=${installOptions.source || 'embedded'} version=${expectedVersion} previous=${previous.packageVersion || 'none'} path="${target}"`);
    return {
      path: target,
      packageVersion: expectedVersion,
      previousVersion: previous.packageVersion || '',
      unchanged: false,
      source: installOptions.source || 'embedded'
    };
  };

  const installAssets = () => {
    if (simulatorRunning()) {
      const error = new Error('MSFS läuft noch. Vor der Asset-Installation bitte den Simulator schließen.');
      error.code = 'SIM_RUNNING';
      throw error;
    }
    const embedded = inspectEmbeddedAssets();
    if (!embedded.embeddedAvailable || !embedded.embeddedPackageComplete) {
      const error = new Error(`Das in der Tracker-EXE enthaltene Assetpaket ist nicht verfügbar oder ungültig: ${embedded.embeddedError || embedded.embeddedPackageVersion || 'unbekannter Fehler'}`);
      error.code = 'EMBEDDED_ASSETS_INVALID';
      throw error;
    }
    return atomicallyInstallAssetPackage(embeddedAssetPackage, catalog.assetPackageVersion, { source: 'embedded', skipIfSameOrNewer: true });
  };

  const checkRemoteAssets = async (checkOptions = {}) => {
    const installed = inspectAssets();
    const remote = await remoteUpdater.check(installed, { force: checkOptions.force === true });
    if (installed.packageComplete && installed.packageVersion === remote.remoteVersion) catalog.registerRuntimeAssets(remote.remoteAssets);
    if (checkOptions.notify === true) {
      sendAck({
        type: 'homebase_v1.assets.update.status',
        commandId: null,
        status: 'ok',
        ...remote
      });
    }
    return remote;
  };

  const installRemoteAssets = async () => {
    if (simulatorRunning()) {
      const error = new Error('MSFS läuft noch. Vor dem Asset-Update bitte den Simulator schließen.');
      error.code = 'SIM_RUNNING';
      throw error;
    }
    const previous = inspectAssets();
    const prepared = await remoteUpdater.prepare(previous);
    if (prepared.unchanged) {
      return { path: previous.packagePath || '', packageVersion: previous.packageVersion, previousVersion: previous.packageVersion, unchanged: true, source: 'remote' };
    }
    try {
      const version = prepared.release.stable.packageVersion;
      const result = atomicallyInstallAssetPackage(prepared.packageRoot, version, { source: 'remote', skipIfSameOrNewer: false });
      fs.mkdirSync(assetCacheRoot, { recursive: true });
      const activeIndex = path.join(assetCacheRoot, 'active-package-index.json');
      const temporary = `${activeIndex}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(prepared.release.index, null, 2)}\n`, 'utf8');
      fs.renameSync(temporary, activeIndex);
      catalog.registerRuntimeAssets(prepared.release.index.assets);
      sendAck({
        type: 'homebase_v1.assets.update.status',
        commandId: null,
        status: 'ok',
        ...remoteUpdater.snapshot(inspectAssets())
      });
      return result;
    } finally {
      prepared.cleanup?.();
    }
  };

  readActiveAssetCatalog();

  const stopSimulator = () => {
    if (!simulatorRunning()) return { message: 'MSFS war bereits geschlossen.' };
    execFileSync('taskkill.exe', ['/IM', 'FlightSimulator2024.exe', '/T'], { windowsHide: true, timeout: 15000 });
    return { message: 'Das Beenden von MSFS wurde angefordert. Der Build wartet, bis der Prozess vollständig geschlossen ist.' };
  };

  const execute = async (command) => {
    const type = String(command?.type || '');
    if (type === 'homebase_v1.assets.status') {
      ack(command, 'assets.status', { status: 'ok', ...inspectAssetState() });
      return;
    }
    if (type === 'homebase_v1.assets.install') {
      if (command?.confirmed !== true) throw Object.assign(new Error('Ausdrückliche Bestätigung zur Asset-Installation fehlt.'), { code: 'CONFIRMATION_REQUIRED' });
      const result = installAssets();
      ack(command, 'assets.install', {
        status: 'ok',
        message: result.unchanged
          ? `Homebase-Assetpaket ${result.packageVersion} ist bereits aktuell.`
          : `Homebase-Assetpaket ${result.packageVersion} wurde sicher installiert${result.previousVersion ? ` und ersetzte ${result.previousVersion}` : ''}.`,
        ...result
      });
      return;
    }
    if (type === 'homebase_v1.assets.update.check') {
      const result = await checkRemoteAssets({ force: command?.force === true });
      ack(command, 'assets.update.check', { status: 'ok', ...inspectAssetState(), ...result });
      return;
    }
    if (type === 'homebase_v1.assets.update.install') {
      if (command?.confirmed !== true) throw Object.assign(new Error('Ausdrückliche Bestätigung zum Asset-Download und zur Installation fehlt.'), { code: 'CONFIRMATION_REQUIRED' });
      const result = await installRemoteAssets();
      ack(command, 'assets.update.install', {
        status: 'ok',
        message: result.unchanged
          ? `Homebase-Assetpaket ${result.packageVersion} ist bereits auf dem Serverstand.`
          : `Homebase-Assetpaket ${result.packageVersion} wurde vom Releasekanal geladen, geprüft und sicher installiert.`,
        ...result
      });
      return;
    }
    if (type === 'homebase_v1.package.status') {
      ack(command, 'package.status', { status: 'ok', ...status() });
      return;
    }
    if (type === 'homebase_v1.simulator.status') {
      ack(command, 'simulator.status', { status: 'ok', running: simulatorRunning() });
      return;
    }
    if (type === 'homebase_v1.simulator.stop') {
      if (command?.confirmed !== true) throw Object.assign(new Error('Ausdrückliche Bestätigung zum Beenden von MSFS fehlt.'), { code: 'CONFIRMATION_REQUIRED' });
      ack(command, 'simulator.stop', { status: 'ok', ...stopSimulator() });
      return;
    }
    if (type === 'homebase_v1.package.prepare') {
      const result = prepare(command?.config);
      ack(command, 'package.prepare', { status: 'ok', message: `SDK-Projekt mit ${result.objectCount} Objekt(en) erzeugt.`, ...result });
      return;
    }
    if (type === 'homebase_v1.package.build') {
      const result = await build(command?.config);
      ack(command, 'package.build', { status: 'ok', message: 'Homebase-Szenenpaket wurde mit dem offiziellen SDK gebaut.', ...result });
      return;
    }
    if (type === 'homebase_v1.package.install') {
      if (command?.confirmed !== true) throw Object.assign(new Error('Ausdrückliche Bestätigung zur Installation fehlt.'), { code: 'CONFIRMATION_REQUIRED' });
      const result = install();
      ack(command, 'package.install', { status: 'ok', message: 'Homebase wurde atomar installiert und geprüft.', ...result });
      return;
    }
    if (type === 'homebase_v1.package.uninstall') {
      if (command?.confirmed !== true) throw Object.assign(new Error('Ausdrückliche Bestätigung zur Deinstallation fehlt.'), { code: 'CONFIRMATION_REQUIRED' });
      const result = uninstall();
      ack(command, 'package.uninstall', { status: 'ok', message: result.removedPaths.length ? 'Homebase wurde aus den Community-Ordnern entfernt.' : 'Homebase war nicht installiert.', ...result });
      return;
    }
    throw new Error(`Unbekannter Homebase-Paketbefehl: ${type}`);
  };

  return {
    capabilities: ['homebase-assets-install', 'homebase-assets-remote-update', 'homebase-package-prepare', 'homebase-package-build', 'homebase-package-install', 'homebase-package-rollback'],
    handleCommand(command) {
      const type = String(command?.type || '');
      if (!/^homebase_v1\.(assets|package|simulator)\./.test(type)) return false;
      queue = queue.catch(() => {}).then(() => execute(command)).catch((error) => {
        const suffix = type.replace(/^homebase_v1\./, '');
        ack(command, suffix, {
          status: 'error',
          code: error?.code || '',
          error: error?.message || String(error),
          message: error?.message || String(error)
        });
        log(`HOMEBASE_PACKAGE_ERROR type=${type} error=${error?.message || error}`);
      });
      return true;
    },
    status,
    inspectAssets,
    inspectEmbeddedAssets,
    inspectAssetState,
    installAssets,
    checkRemoteAssets,
    installRemoteAssets
  };
}

module.exports = { createHomebasePackageService, createSceneXml, normalizeConfig, tasklistHasSimulatorProcess, validateLayoutPackage, waitForSimulatorExit };
