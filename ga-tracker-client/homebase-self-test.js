'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHomebaseObjectManager } = require('./homebase-object-manager.js');
const { createHomebasePackageService, createSceneXml, tasklistHasSimulatorProcess, waitForSimulatorExit } = require('./homebase-package-service.js');
const { compareVersions, extractZipBuffer } = require('./homebase-asset-updater.js');
const catalog = require('./homebase-asset-catalog.js');

class FakeHandle extends EventEmitter {
  constructor() {
    super();
    this.nextObjectId = 7000;
    this.addedEventId = null;
    this.removedEventId = null;
    this.positions = new Map();
  }

  addToDataDefinition() { return 0; }
  mapClientEventToSimEvent() { return 0; }
  transmitClientEvent() { return 0; }
  subscribeToSystemEvent(eventId, name) {
    if (name === 'ObjectAdded') this.addedEventId = eventId;
    if (name === 'ObjectRemoved') this.removedEventId = eventId;
    return 0;
  }
  aICreateSimulatedObject(_title, _position, requestId) {
    const objectId = this.nextObjectId++;
    setTimeout(() => this.emit('assignedObjectID', { requestID: requestId, objectID: objectId }), 2);
    setTimeout(() => this.emit('eventAddRemove', { clientEventId: this.addedEventId, data: objectId }), 4);
    return requestId + 1000;
  }
  aIRemoveObject(objectId, requestId) {
    setTimeout(() => this.emit('eventAddRemove', { clientEventId: this.removedEventId, data: objectId }), 3);
    return requestId + 2000;
  }
  setDataOnSimObject(_definitionId, objectId, data) {
    this.positions.set(objectId, data);
    return 0;
  }
  requestDataOnSimObject(requestId) {
    setTimeout(() => this.emit('simObjectData', {
      requestID: requestId,
      data: { readFloat64: () => 514.25 }
    }), 3);
    return 0;
  }
}

function waitForAck(acks, type, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const index = acks.findIndex((ack) => ack.type === type);
      if (index >= 0) return resolve(acks.splice(index, 1)[0]);
      if (Date.now() - started > timeoutMs) return reject(new Error(`ACK timeout: ${type}`));
      setTimeout(tick, 5);
    };
    tick();
  });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function packageFileRecords(root) {
  const relativeFiles = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) relativeFiles.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  };
  walk(root);
  return relativeFiles.map((relative) => {
    const absolute = path.join(root, ...relative.split('/'));
    const data = fs.readFileSync(absolute);
    return { path: relative, size: data.length, sha256: sha256(data) };
  });
}

function contentHash(files) {
  return sha256(Buffer.from(files.map((file) => `${file.path}:${file.size}:${file.sha256}`).join('\n')));
}

function createRemoteReleaseFixture({ sourcePackage, root, version, createZip, entriesFromDirectory, archiveHashOverride = '' }) {
  const packageRoot = path.join(root, `package-${version}`, catalog.assetPackageName);
  fs.cpSync(sourcePackage, packageRoot, { recursive: true });
  const manifestPath = path.join(packageRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.package_version = version;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const files = packageFileRecords(packageRoot);
  const packageHash = contentHash(files);
  const tag = `homebase-assets-v${version}`;
  const indexUrl = `https://test.invalid/${version}/package-index.json`;
  const archiveUrl = `https://test.invalid/${version}/full.zip`;
  const archivePath = path.join(root, `homebase-assets-${version}.zip`);
  createZip(entriesFromDirectory(packageRoot, catalog.assetPackageName), archivePath);
  const archive = fs.readFileSync(archivePath);
  const archiveDescriptor = {
    name: `${catalog.assetPackageName}-${version}-full.zip`,
    url: archiveUrl,
    size: archive.length,
    sha256: archiveHashOverride || sha256(archive)
  };
  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    packageName: catalog.assetPackageName,
    packageVersion: version,
    releaseTag: tag,
    contentHash: packageHash,
    files,
    assets: catalog.assets.map((asset) => ({
      ...asset,
      ...(asset.key === 'generator' ? { workbenchVisible: false } : {})
    })),
    changedAssets: catalog.assets.map((asset) => asset.key),
    removedAssets: [],
    // A locally prepared publisher index may not know its final release URL yet;
    // stable.json is the authoritative download pointer after publication.
    fullArchive: { ...archiveDescriptor, url: '' }
  };
  const stable = {
    schemaVersion: 1,
    publishedAt: new Date().toISOString(),
    packageName: catalog.assetPackageName,
    packageVersion: version,
    releaseTag: tag,
    indexUrl,
    contentHash: packageHash,
    fullArchive: archiveDescriptor,
    changedAssets: index.changedAssets,
    removedAssets: []
  };
  const channelUrl = `https://test.invalid/${version}/stable.json`;
  const responses = new Map([
    [channelUrl, Buffer.from(JSON.stringify(stable))],
    [indexUrl, Buffer.from(JSON.stringify(index))],
    [archiveUrl, archive]
  ]);
  return {
    channelUrl,
    index,
    stable,
    archive,
    requestBuffer: async (url) => {
      if (!responses.has(url)) throw new Error(`Unerwartete Test-URL: ${url}`);
      return Buffer.from(responses.get(url));
    }
  };
}

async function run() {
  if (compareVersions('0.5.7', '0.5.6') <= 0 || compareVersions('0.5.7', '0.5.7') !== 0 || compareVersions('1.0.0-beta.1', '1.0.0') >= 0) {
    throw new Error('Asset version comparison failed.');
  }
  if (!tasklistHasSimulatorProcess('"FlightSimulator2024.exe","1234","Console","1","1,234 K"')) {
    throw new Error('Exact simulator tasklist detection failed.');
  }
  if (tasklistHasSimulatorProcess('INFO: No tasks are running which match FlightSimulator2024.exe.')) {
    throw new Error('Simulator tasklist no-match text caused a false positive.');
  }
  if (tasklistHasSimulatorProcess('INFORMATION: Keine Aufgaben entsprechen dem Filter FlightSimulator2024.exe.')) {
    throw new Error('Localized simulator tasklist no-match text caused a false positive.');
  }
  let simulatorChecks = 0;
  const simulatorWaits = [];
  const simulatorExit = await waitForSimulatorExit(() => {
    simulatorChecks += 1;
    return simulatorChecks < 4;
  }, {
    maxChecks: 6,
    delayMs: 25,
    wait: async (milliseconds) => simulatorWaits.push(milliseconds)
  });
  if (simulatorExit.retries !== 3 || simulatorExit.waitedMs !== 75 || simulatorWaits.join(',') !== '25,25,25') {
    throw new Error(`Simulator exit retry failed: ${JSON.stringify({ simulatorExit, simulatorWaits })}`);
  }
  let simulatorTimeout = null;
  try {
    await waitForSimulatorExit(() => true, { maxChecks: 3, delayMs: 10, wait: async () => {} });
  } catch (error) {
    simulatorTimeout = error;
  }
  if (simulatorTimeout?.code !== 'SIM_RUNNING' || simulatorTimeout?.waitedMs !== 20) throw new Error('Simulator exit timeout guard failed.');
  const cardboard = catalog.objectDefinitionForTitle('Cardboard');
  const pallet = catalog.objectDefinitionForTitle('Pallet01_01');
  if (cardboard?.groundClearanceFt !== 0.30 || cardboard?.liveGroundStabilization !== true) {
    throw new Error('Cardboard ground placement metadata is incomplete.');
  }
  if (pallet?.groundClearanceFt !== 0.08 || pallet?.liveGroundStabilization !== true || pallet?.lowResAltitude !== true) {
    throw new Error('Pallet ground placement metadata is incomplete.');
  }

  const acks = [];
  const handle = new FakeHandle();
  const manager = createHomebaseObjectManager(handle, { sendAck: (ack) => acks.push(ack) });

  manager.handleCommand({ type: 'homebase_v1.capabilities', commandId: 'cap-1' });
  const capabilityAck = await waitForAck(acks, 'homebase_v1.capabilities_ack');
  if (capabilityAck.status !== 'ok' || capabilityAck.protocol !== 1) throw new Error('Capability contract failed.');
  if (!capabilityAck.capabilities.includes('homebase-object-remove')) throw new Error('Object remove capability missing.');

  manager.handleCommand({
    type: 'homebase_v1.preview.set',
    commandId: 'set-1',
    parentCommandId: 'parent-1',
    objects: [
      { id: 'hangar', title: 'VFR Multitool Homebase Hangar', label: 'Hangar', lat: 48, lon: 8, altFt: 514, heightOffsetFt: 0, heading: 270 },
      { id: 'box-1', title: 'Cardboard', label: 'Karton', lat: 48.00001, lon: 8.00001, altFt: 514, heightOffsetFt: 0, heading: 0 }
    ]
  });
  const setAck = await waitForAck(acks, 'homebase_v1.preview.set_ack');
  if (setAck.status !== 'ok' || setAck.objectCount !== 2 || manager.snapshot().objectCount !== 2) throw new Error('Preview set failed.');

  manager.handleCommand({
    type: 'homebase_v1.preview.object.move',
    commandId: 'move-1',
    object: { id: 'box-1', title: 'Cardboard', label: 'Karton', lat: 48.00002, lon: 8.00002, altFt: 514, heightOffsetFt: 1, heading: 15 }
  });
  const moveAck = await waitForAck(acks, 'homebase_v1.preview.object.move_ack');
  if (moveAck.status !== 'ok' || moveAck.groundAltitudeFt !== 514.25) throw new Error('Preview move/ground query failed.');

  manager.handleCommand({
    type: 'homebase_v1.preview.object.remove',
    commandId: 'remove-1',
    id: 'box-1',
    label: 'Karton'
  });
  const removeAck = await waitForAck(acks, 'homebase_v1.preview.object.remove_ack');
  if (removeAck.status !== 'ok' || removeAck.removedCount !== 1 || manager.snapshot().objectCount !== 1) {
    throw new Error('Confirmed object remove failed.');
  }

  manager.handleCommand({ type: 'homebase_v1.preview.clear', commandId: 'clear-1' });
  const clearAck = await waitForAck(acks, 'homebase_v1.preview.clear_ack');
  if (clearAck.status !== 'ok' || clearAck.removedCount !== 1 || manager.snapshot().objectCount !== 0) throw new Error('Confirmed preview clear failed.');

  const scene = createSceneXml({
    spawn: { lat: 48, lon: 8, altFt: 500, heading: 90 },
    hangar: { lat: 48, lon: 8, heading: 270, objectTitle: 'VFR Multitool Homebase Hangar' },
    objects: [
      { id: 'box', title: 'Cardboard', lat: 48, lon: 8, heightOffsetFt: 0, heading: 0, scale: 1 },
      { id: 'pallet', title: 'Pallet01_01', lat: 48.00001, lon: 8.00001, heightOffsetFt: 0, heading: 0, scale: 1 }
    ]
  });
  if (!scene.content.includes('applyFlatten="FALSE"')) throw new Error('Terrain flatten guard missing.');
  if (!scene.content.includes('alt="0.091"')) throw new Error('Cardboard clearance conversion failed.');
  if (!scene.content.includes('alt="0.024"')) throw new Error('Pallet clearance conversion failed.');
  if (!/<SceneryObject[^>]*alt="0\.024"[^>]*>\n    <LowResAltitude\/>\n    <SimObject containerTitle="Pallet01_01"/s.test(scene.content)) {
    throw new Error('Pallet LowResAltitude guard missing.');
  }
  if (/<SceneryObject[^>]*alt="0\.091"[^>]*>\n    <LowResAltitude\/>/s.test(scene.content)) {
    throw new Error('LowResAltitude must stay pallet-specific.');
  }
  if (!scene.content.includes('type="RAMP_GA_SMALL"')) throw new Error('Homebase spawn parking missing.');

  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'homebase-assets-test-'));
  try {
    const { createZip, entriesFromDirectory } = await import('../homebase/asset-publisher/zip-utils.mjs');
    const embeddedAssetPackagePath = process.env.VFR_HOMEBASE_ASSET_PACKAGE_SOURCE
      ? path.resolve(process.env.VFR_HOMEBASE_ASSET_PACKAGE_SOURCE)
      : path.resolve(__dirname, 'embedded-homebase-assets', catalog.assetPackageName);
    const packageService = createHomebasePackageService({
      runtimeDir: testRoot,
      appData: path.join(testRoot, 'AppData', 'Roaming'),
      embeddedAssetPackagePath,
      isSimulatorRunning: () => false
    });
    if (!packageService.capabilities.includes('homebase-assets-install')) throw new Error('Asset install capability missing.');
    const embedded = packageService.inspectEmbeddedAssets();
    if (!embedded.embeddedAvailable || !embedded.embeddedPackageComplete || embedded.embeddedPackageVersion !== catalog.assetPackageVersion) {
      throw new Error(`Embedded asset inspection failed: ${JSON.stringify(embedded)}`);
    }
    const installed = packageService.installAssets();
    if (installed.packageVersion !== catalog.assetPackageVersion || installed.unchanged) throw new Error('Atomic asset installation failed.');
    const inspected = packageService.inspectAssets();
    if (!inspected.packageComplete || inspected.packageVersion !== catalog.assetPackageVersion) throw new Error('Installed asset validation failed.');
    const repeated = packageService.installAssets();
    if (!repeated.unchanged) throw new Error('Repeated asset installation must be idempotent.');
    const interruptedBackup = `${installed.path}.__backup`;
    fs.renameSync(installed.path, interruptedBackup);
    if (fs.existsSync(installed.path) || !fs.existsSync(interruptedBackup)) throw new Error('Interrupted-install fixture could not be prepared.');

    const remoteRelease = createRemoteReleaseFixture({
      sourcePackage: embeddedAssetPackagePath,
      root: testRoot,
      version: '0.6.1',
      createZip,
      entriesFromDirectory
    });
    const remoteAcks = [];
    const remoteService = createHomebasePackageService({
      runtimeDir: path.join(testRoot, 'remote-runtime'),
      appData: path.join(testRoot, 'AppData', 'Roaming'),
      embeddedAssetPackagePath,
      assetChannelUrl: remoteRelease.channelUrl,
      remoteRequestBuffer: remoteRelease.requestBuffer,
      remoteCacheTtlMs: 1,
      sendAck: (ack) => remoteAcks.push(ack),
      isSimulatorRunning: () => false
    });
    if (!remoteService.capabilities.includes('homebase-assets-remote-update')) throw new Error('Remote asset update capability missing.');
    const remoteStatus = await remoteService.checkRemoteAssets({ force: true });
    if (!remoteStatus.remoteAvailable || !remoteStatus.updateAvailable || remoteStatus.remoteVersion !== '0.6.1') {
      throw new Error(`Remote asset check failed: ${JSON.stringify(remoteStatus)}`);
    }
    if (!Array.isArray(remoteStatus.remoteAssets) || remoteStatus.remoteAssets.length !== catalog.assets.length) {
      throw new Error('Remote asset catalog was not exposed to the app.');
    }
    if (remoteStatus.remoteAssets.find((asset) => asset.key === 'generator')?.workbenchVisible !== false) {
      throw new Error('Remote workbench visibility was not exposed to the app.');
    }
    const remoteInstalled = await remoteService.installRemoteAssets();
    if (remoteInstalled.packageVersion !== '0.6.1' || remoteInstalled.source !== 'remote' || remoteInstalled.unchanged) {
      throw new Error(`Remote asset installation failed: ${JSON.stringify(remoteInstalled)}`);
    }
    const remoteInspection = remoteService.inspectAssets();
    if (!remoteInspection.packageComplete || remoteInspection.packageVersion !== '0.6.1') throw new Error('Remote package inspection failed.');
    if (fs.existsSync(interruptedBackup)) throw new Error('Interrupted package backup was not recovered and cleaned.');
    const activeIndexPath = path.join(testRoot, 'remote-runtime', 'homebase-asset-cache', 'active-package-index.json');
    if (!fs.existsSync(activeIndexPath) || JSON.parse(fs.readFileSync(activeIndexPath, 'utf8')).packageVersion !== '0.6.1') {
      throw new Error('Active remote package index was not persisted.');
    }
    const activeCatalog = remoteService.inspectAssetState().assetCatalog;
    if (!Array.isArray(activeCatalog) || activeCatalog.length !== catalog.assets.length) {
      throw new Error('Installed asset catalog was not restored from the active package index.');
    }
    if (activeCatalog.find((asset) => asset.key === 'generator')?.workbenchVisible !== false) {
      throw new Error('Installed workbench visibility was not restored from the active package index.');
    }
    const noDowngrade = remoteService.installAssets();
    if (!noDowngrade.unchanged || noDowngrade.packageVersion !== '0.6.1') throw new Error('Embedded fallback downgraded a newer remote package.');

    remoteService.handleCommand({ type: 'homebase_v1.assets.update.install', commandId: 'remote-no-confirm' });
    const confirmationAck = await waitForAck(remoteAcks, 'homebase_v1.assets.update.install_ack');
    if (confirmationAck.status !== 'error' || confirmationAck.code !== 'CONFIRMATION_REQUIRED') throw new Error('Remote install confirmation guard failed.');

    const badHashRelease = createRemoteReleaseFixture({
      sourcePackage: embeddedAssetPackagePath,
      root: testRoot,
      version: '0.6.2',
      createZip,
      entriesFromDirectory,
      archiveHashOverride: '0'.repeat(64)
    });
    const badHashService = createHomebasePackageService({
      runtimeDir: path.join(testRoot, 'bad-hash-runtime'),
      appData: path.join(testRoot, 'AppData', 'Roaming'),
      embeddedAssetPackagePath,
      assetChannelUrl: badHashRelease.channelUrl,
      remoteRequestBuffer: badHashRelease.requestBuffer,
      isSimulatorRunning: () => false
    });
    let hashRejected = false;
    try {
      await badHashService.installRemoteAssets();
    } catch (error) {
      hashRejected = /SHA-256/.test(error?.message || '');
    }
    if (!hashRejected || badHashService.inspectAssets().packageVersion !== '0.6.1') throw new Error('Hash rejection did not preserve the installed package.');

    const rollbackRelease = createRemoteReleaseFixture({
      sourcePackage: embeddedAssetPackagePath,
      root: testRoot,
      version: '0.6.2',
      createZip,
      entriesFromDirectory
    });
    const rollbackService = createHomebasePackageService({
      runtimeDir: path.join(testRoot, 'rollback-runtime'),
      appData: path.join(testRoot, 'AppData', 'Roaming'),
      embeddedAssetPackagePath,
      assetChannelUrl: rollbackRelease.channelUrl,
      remoteRequestBuffer: rollbackRelease.requestBuffer,
      isSimulatorRunning: () => false
    });
    const originalRenameSync = fs.renameSync;
    let rollbackRejected = false;
    try {
      fs.renameSync = (source, target) => {
        if (String(source).endsWith(`${catalog.assetPackageName}.__staging`) && path.basename(String(target)) === catalog.assetPackageName) {
          throw new Error('Simulierter Austauschfehler');
        }
        return originalRenameSync(source, target);
      };
      await rollbackService.installRemoteAssets();
    } catch (error) {
      rollbackRejected = /zurückgerollt/.test(error?.message || '');
    } finally {
      fs.renameSync = originalRenameSync;
    }
    if (!rollbackRejected || rollbackService.inspectAssets().packageVersion !== '0.6.1') throw new Error('Atomic rollback failed to restore the previous package.');

    const traversalZipPath = path.join(testRoot, 'traversal.zip');
    createZip([{ name: 'evil.txt', data: Buffer.from('blocked') }], traversalZipPath);
    const traversalZip = fs.readFileSync(traversalZipPath);
    const originalName = Buffer.from('evil.txt');
    const traversalName = Buffer.from('../x.txt');
    let replacements = 0;
    for (let offset = traversalZip.indexOf(originalName); offset >= 0; offset = traversalZip.indexOf(originalName, offset + traversalName.length)) {
      traversalName.copy(traversalZip, offset);
      replacements += 1;
    }
    let traversalRejected = false;
    try {
      extractZipBuffer(traversalZip, path.join(testRoot, 'traversal-output'));
    } catch (error) {
      traversalRejected = /Unsicherer Archivpfad/.test(error?.message || '');
    }
    if (replacements !== 2 || !traversalRejected) throw new Error('ZIP path traversal guard failed.');
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }

  console.log('Homebase tracker self-test passed.');
}

run().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
