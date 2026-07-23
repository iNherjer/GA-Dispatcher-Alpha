'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { createHomebaseObjectManager } = require('./homebase-object-manager.js');
const {
  createHomebasePackageService,
  createSceneXml,
  tasklistHasSimulatorProcess,
  waitForSimulatorExit,
  discoverCommunityFolders,
  selectCommunityFolder
} = require('./homebase-package-service.js');
const { compareVersions, extractZipBuffer } = require('./homebase-asset-updater.js');
const {
  normalizeHomebaseFallbackCache,
  compatibleHomebaseFallbackCache,
  fallbackShouldBeActive
} = require('./homebase-fallback-cache.js');
const catalog = require('./homebase-asset-catalog.js');

class FakeHandle extends EventEmitter {
  constructor() {
    super();
    this.nextObjectId = 7000;
    this.addedEventId = null;
    this.removedEventId = null;
    this.positions = new Map();
    this.waypointRoutes = [];
    this.failedTitles = new Set();
  }

  addToDataDefinition() { return 0; }
  mapClientEventToSimEvent() { return 0; }
  transmitClientEvent() { return 0; }
  subscribeToSystemEvent(eventId, name) {
    if (name === 'ObjectAdded') this.addedEventId = eventId;
    if (name === 'ObjectRemoved') this.removedEventId = eventId;
    return 0;
  }
  aICreateSimulatedObject(title, _position, requestId) {
    const sendId = requestId + 1000;
    if (this.failedTitles.has(title)) {
      setTimeout(() => this.emit('exception', { sendId, exceptionName: `TEST_CREATE_FAILED:${title}` }), 2);
      return sendId;
    }
    const objectId = this.nextObjectId++;
    setTimeout(() => this.emit('assignedObjectID', { requestID: requestId, objectID: objectId }), 2);
    setTimeout(() => this.emit('eventAddRemove', { clientEventId: this.addedEventId, data: objectId }), 4);
    return sendId;
  }
  aIRemoveObject(objectId, requestId) {
    setTimeout(() => this.emit('eventAddRemove', { clientEventId: this.removedEventId, data: objectId }), 3);
    return requestId + 2000;
  }
  setDataOnSimObject(_definitionId, objectId, data) {
    if (data?.buffer && typeof data.buffer.getBuffer !== 'function') {
      throw new Error('SimConnect buffer payload must use RawBuffer.');
    }
    if (Array.isArray(data)) this.waypointRoutes.push({ objectId, points: data.length });
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

function waitForCondition(predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) return resolve(true);
      if (Date.now() - started > timeoutMs) return reject(new Error('Condition timeout'));
      setTimeout(tick, 10);
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

function bumpPatchVersion(version, increment = 1) {
  const match = String(version || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Unsupported test asset version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + increment}`;
}

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function zipCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = ZIP_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function testZipEntriesFromDirectory(root, prefix = '') {
  const entries = [];
  const walk = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) walk(absolute);
      else if (item.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join('/');
        entries.push({ name: prefix ? `${prefix}/${relative}` : relative, data: fs.readFileSync(absolute) });
      }
    }
  };
  walk(root);
  return entries;
}

function createTestZip(entries, outputPath) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(String(entry.name).replaceAll('\\', '/'), 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const checksum = zipCrc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, name, compressed);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat([...localParts, central, end]));
}

function createMinimalAssetPackageFixture(root) {
  const packageRoot = path.join(root, catalog.assetPackageName);
  const content = [];
  for (const asset of catalog.assets) {
    const relative = `SimObjects/Misc/${asset.folder}/sim.cfg`;
    const absolute = path.join(packageRoot, ...relative.split('/'));
    const data = Buffer.from(`[VERSION]\nmajor=1\nminor=0\n\n[GENERAL]\ntitle=${asset.title}\n`);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, data);
    content.push({ path: relative, size: data.length, date: 0 });
  }
  fs.writeFileSync(path.join(packageRoot, 'manifest.json'), `${JSON.stringify({
    dependencies: [],
    content_type: 'MISC',
    title: 'Homebase self-test assets',
    manufacturer: 'VFR Multitool',
    creator: 'VFR Multitool',
    package_version: catalog.assetPackageVersion,
    minimum_game_version: '1.0.0'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(packageRoot, 'layout.json'), `${JSON.stringify({ content }, null, 2)}\n`);
  return packageRoot;
}

function createRemoteReleaseFixture({ sourcePackage, root, version, createZip, entriesFromDirectory, archiveHashOverride = '', contentHashOverride = '' }) {
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
    contentHash: contentHashOverride || packageHash,
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
    contentHash: contentHashOverride || packageHash,
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
  const requestedUrls = [];
  return {
    channelUrl,
    index,
    stable,
    archive,
    requestBuffer: async (url) => {
      requestedUrls.push(url);
      const normalizedUrl = new URL(url);
      normalizedUrl.searchParams.delete('_vfrcb');
      const key = normalizedUrl.toString();
      if (!responses.has(key)) throw new Error(`Unerwartete Test-URL: ${url}`);
      return Buffer.from(responses.get(key));
    },
    requestedUrls
  };
}

async function run() {
  const expectedTarmacTitles = new Set();
  for (const gender of ['Male', 'Female']) {
    for (const season of ['Summer', 'Winter']) {
      for (const ethnicity of ['African', 'Arab', 'Asian', 'Caucasian', 'Hispanic', 'Indian']) {
        expectedTarmacTitles.add(`Tarmac_${gender}_${season}_${ethnicity}`);
      }
    }
  }
  const actualTarmacTitles = new Set((catalog.tarmacPeople || []).map((entry) => entry.title));
  if (actualTarmacTitles.size !== expectedTarmacTitles.size
    || [...expectedTarmacTitles].some((title) => !actualTarmacTitles.has(title))
    || [...actualTarmacTitles].some((title) => /_Black$/.test(title))) {
    throw new Error(`Tarmac people catalog mismatch: ${JSON.stringify([...actualTarmacTitles])}`);
  }
  const fallbackCache = normalizeHomebaseFallbackCache({
    schemaVersion: 1,
    sceneSignature: 'hb1-test-42',
    base: { lat: 48.1, lon: 7.9, enterRadiusNm: 20, exitRadiusNm: 22 },
    objects: [{ id: 'crate-1', title: 'Test crate' }],
    people: [{ id: 'person-1', title: 'Tarmac_Female_Summer_Asian' }],
    navigation: { spawn: { lat: 48.1, lon: 7.9 } },
    controlStates: [{
      instanceId: 'lantern-1',
      title: 'VFR Multitool Homebase Stable Lantern',
      controlId: 'light',
      stateId: 'off',
      simvar: 'L:UNTRUSTED_CLIENT_VALUE',
      value: 999
    }]
  }, { pilotId: 'TESTER', trackerVersionCode: 306, savedAt: 12345 });
  if (fallbackCache.pilotId !== 'TESTER' || fallbackCache.trackerVersionCode !== 306 || fallbackCache.objects.length !== 1 || fallbackCache.people.length !== 1
    || fallbackCache.controlStates.length !== 1 || 'simvar' in fallbackCache.controlStates[0] || 'value' in fallbackCache.controlStates[0]) {
    throw new Error(`Homebase fallback normalization failed: ${JSON.stringify(fallbackCache)}`);
  }
  if (!compatibleHomebaseFallbackCache(fallbackCache, { pilotId: 'TESTER', trackerVersionCode: 306 }).ok) {
    throw new Error('Compatible Homebase fallback was rejected.');
  }
  if (!compatibleHomebaseFallbackCache(fallbackCache, { pilotId: 'TESTER', trackerVersionCode: 313 }).ok) {
    throw new Error('Schema-compatible Homebase fallback did not survive a tracker update.');
  }
  if (!fallbackShouldBeActive(fallbackCache, { lat: 48.1, lon: 7.9 }, false)
    || fallbackShouldBeActive(fallbackCache, { lat: 49, lon: 9 }, true)) {
    throw new Error('Homebase fallback radius hysteresis failed.');
  }
  if (compareVersions('0.5.7', '0.5.6') <= 0 || compareVersions('0.5.7', '0.5.7') !== 0 || compareVersions('1.0.0-beta.1', '1.0.0') >= 0) {
    throw new Error('Asset version comparison failed.');
  }
  const remoteVersion = bumpPatchVersion(catalog.assetPackageVersion);
  const nextRemoteVersion = bumpPatchVersion(catalog.assetPackageVersion, 2);
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
  const tentHangar = catalog.objectDefinitionForTitle('VFR Multitool Homebase Hangar');
  const tentDoor = tentHangar?.controls?.find((control) => control.id === 'door');
  const tentLight = tentHangar?.controls?.find((control) => control.id === 'interiorLight');
  if (tentHangar?.headingCorrectionDeg !== 0
    || tentDoor?.simvar !== 'L:1:VFR_HOMEBASE_HANGAR_DOOR_COMMAND'
    || tentDoor?.scope !== 'simobject'
    || tentLight?.simvar !== 'L:1:VFR_HOMEBASE_HANGAR_LIGHT_COMMAND'
    || tentLight?.scope !== 'simobject') {
    throw new Error('Tent-hangar controls or heading correction are incomplete.');
  }

  catalog.registerRuntimeAssets([{
    key: 'roundHangar', folder: 'VFRHomebaseRoundHangar', title: 'VFR Multitool Homebase Round Hangar',
    kind: 'hangar', group: 'Hangars', label: 'Rundhangar mit Schiebetor', homebasePlaceable: true,
    controls: [{
      schemaVersion: 1, id: 'interiorLight', type: 'light', label: 'Innenbeleuchtung', transport: 'simconnect-lvar',
      simvar: 'L:1:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND', unit: 'number', scope: 'simobject', defaultState: 'on',
      states: [{ id: 'on', label: 'Einschalten', value: 0 }, { id: 'off', label: 'Ausschalten', value: 1 }]
    }]
  }]);
  const roundHangar = catalog.objectDefinitionForTitle('VFR Multitool Homebase Round Hangar');
  if (roundHangar?.headingCorrectionDeg !== 0 || !roundHangar?.controls?.some((control) => control.id === 'door') || !roundHangar?.controls?.some((control) => control.id === 'interiorLight')) {
    throw new Error('Runtime catalog update did not preserve and extend the round-hangar controls.');
  }
  const stableLantern = catalog.objectDefinitionForTitle('VFR Multitool Homebase Stable Lantern');
  const stableLanternLight = stableLantern?.controls?.find((control) => control.id === 'light');
  if (stableLantern?.key !== 'stableLantern'
    || stableLanternLight?.simvar !== 'L:1:VFR_HOMEBASE_STABLE_LANTERN_LIGHT_COMMAND'
    || stableLanternLight?.scope !== 'simobject'
    || stableLanternLight?.states?.find((state) => state.id === 'on')?.value !== 0
    || stableLanternLight?.states?.find((state) => state.id === 'off')?.value !== 1) {
    throw new Error('Stable-lantern control contract is incomplete.');
  }
  const constructionFloodlight = catalog.objectDefinitionForTitle('VFR Multitool Homebase Construction Floodlight Tripod');
  const constructionFloodlightLight = constructionFloodlight?.controls?.find((control) => control.id === 'light');
  if (constructionFloodlight?.key !== 'constructionFloodlightTripod'
    || constructionFloodlight?.version !== '1.0.1'
    || constructionFloodlight?.group !== 'Beleuchtung'
    || constructionFloodlightLight?.simvar !== 'L:1:VFR_HOMEBASE_CONSTRUCTION_FLOODLIGHT_LIGHT_COMMAND'
    || constructionFloodlightLight?.scope !== 'simobject'
    || constructionFloodlightLight?.states?.find((state) => state.id === 'on')?.value !== 0
    || constructionFloodlightLight?.states?.find((state) => state.id === 'off')?.value !== 1) {
    throw new Error('Construction-floodlight control contract is incomplete.');
  }

  const acks = [];
  const logs = [];
  const handle = new FakeHandle();
  const manager = createHomebaseObjectManager(handle, { sendAck: (ack) => acks.push(ack), log: (entry) => logs.push(entry), random: () => 0 });

  manager.handleCommand({ type: 'homebase_v1.capabilities', commandId: 'cap-1' });
  const capabilityAck = await waitForAck(acks, 'homebase_v1.capabilities_ack');
  if (capabilityAck.status !== 'ok' || capabilityAck.protocol !== 1) throw new Error('Capability contract failed.');
  if (!capabilityAck.capabilities.includes('homebase-object-remove')) throw new Error('Object remove capability missing.');
  if (!capabilityAck.capabilities.includes('homebase-hangar-animation')) throw new Error('Hangar animation capability missing.');
  if (!capabilityAck.capabilities.includes('homebase-object-controls-v1')) throw new Error('Generic object control capability missing.');
  if (!capabilityAck.capabilities.includes('homebase-door-automation-v1')) throw new Error('Door automation capability missing.');
  if (!capabilityAck.capabilities.includes('homebase-door-manual-override-v1')) throw new Error('Door manual override capability missing.');
  if (!capabilityAck.capabilities.includes('homebase-people-routes-v1')) throw new Error('Homebase people route capability missing.');
  if (!capabilityAck.capabilities.includes('homebase-people-live-update-v1')) throw new Error('Homebase people live-update capability missing.');

  manager.handleCommand({
    type: 'homebase_v1.preview.set',
    commandId: 'round-hangar-preview',
    objects: [
      { id: 'hangar', title: 'VFR Multitool Homebase Round Hangar', label: 'Rundhangar', lat: 48, lon: 8, altFt: 514, heightOffsetFt: 0, heading: 270 },
      { id: 'lantern', title: 'VFR Multitool Homebase Stable Lantern', label: 'Stalllaterne', lat: 48.00001, lon: 8.00001, altFt: 514, heightOffsetFt: 0, heading: 0 },
      { id: 'construction-floodlight', title: 'VFR Multitool Homebase Construction Floodlight Tripod', label: 'Baustrahler mit Stativ', lat: 48.00002, lon: 8.00002, altFt: 514, heightOffsetFt: 0, heading: 0 }
    ],
    controlStates: [
      { instanceId: 'hangar', title: 'VFR Multitool Homebase Round Hangar', controlId: 'door', stateId: 'closed', value: 0 },
      { instanceId: 'lantern', title: 'VFR Multitool Homebase Stable Lantern', controlId: 'light', stateId: 'off', value: 0 }
    ]
  });
  const roundHangarPreviewAck = await waitForAck(acks, 'homebase_v1.preview.set_ack');
  if (roundHangarPreviewAck.status !== 'ok' || roundHangarPreviewAck.objectCount !== 3
    || roundHangarPreviewAck.controlStateCount !== 2 || roundHangarPreviewAck.controlFailureCount !== 0
    || handle.positions.get(7000)?.buffer?.getBuffer?.().readDoubleLE(0) !== 1
    || handle.positions.get(7001)?.buffer?.getBuffer?.().readDoubleLE(0) !== 1) {
    throw new Error(`Controlled-object preview state restoration failed: ${JSON.stringify(roundHangarPreviewAck)}`);
  }

  manager.handleCommand({
    type: 'homebase_v1.object.control.set',
    commandId: 'round-hangar-generic-close',
    title: 'VFR Multitool Homebase Round Hangar',
    controlId: 'door',
    state: 'closed',
    instanceId: 'hangar'
  });
  const genericControlAck = await waitForAck(acks, 'homebase_v1.object.control.set_ack');
  if (genericControlAck.status !== 'ok' || genericControlAck.controlId !== 'door' || genericControlAck.state !== 'closed' || genericControlAck.value !== 1 || genericControlAck.manualOverrideActive !== true) {
    throw new Error(`Generic object control failed: ${JSON.stringify(genericControlAck)}`);
  }
  manager.handleCommand({
    type: 'homebase_v1.object.control.set', commandId: 'round-hangar-light-off',
    title: 'VFR Multitool Homebase Round Hangar', controlId: 'interiorLight', state: 'off', instanceId: 'hangar'
  });
  const lightControlAck = await waitForAck(acks, 'homebase_v1.object.control.set_ack');
  if (lightControlAck.status !== 'ok' || lightControlAck.controlId !== 'interiorLight' || lightControlAck.state !== 'off' || lightControlAck.value !== 1 || lightControlAck.controlScope !== 'simobject' || lightControlAck.objectId !== 7000) {
    throw new Error(`Generic light control failed: ${JSON.stringify(lightControlAck)}`);
  }
  manager.handleCommand({
    type: 'homebase_v1.object.control.set',
    commandId: 'stable-lantern-light-off',
    title: 'VFR Multitool Homebase Stable Lantern',
    controlId: 'light',
    stateId: 'off',
    instanceId: 'lantern'
  });
  const lanternLightAck = await waitForAck(acks, 'homebase_v1.object.control.set_ack');
  if (lanternLightAck.status !== 'ok' || lanternLightAck.controlId !== 'light' || lanternLightAck.stateId !== 'off'
    || lanternLightAck.value !== 1 || lanternLightAck.controlScope !== 'simobject' || lanternLightAck.objectId !== 7001) {
    throw new Error(`Stable-lantern light control failed: ${JSON.stringify(lanternLightAck)}`);
  }
  const lanternPayload = handle.positions.get(7001);
  const lanternBuffer = lanternPayload?.buffer?.getBuffer?.();
  if (!lanternBuffer || lanternBuffer.readDoubleLE(0) !== 1) throw new Error('Stable-lantern light did not write value 1 to its own Object-ID.');
  manager.handleCommand({
    type: 'homebase_v1.object.control.set',
    commandId: 'construction-floodlight-light-off',
    title: 'VFR Multitool Homebase Construction Floodlight Tripod',
    controlId: 'light',
    stateId: 'off',
    instanceId: 'construction-floodlight'
  });
  const constructionFloodlightAck = await waitForAck(acks, 'homebase_v1.object.control.set_ack');
  if (constructionFloodlightAck.status !== 'ok' || constructionFloodlightAck.controlId !== 'light' || constructionFloodlightAck.stateId !== 'off'
    || constructionFloodlightAck.value !== 1 || constructionFloodlightAck.controlScope !== 'simobject' || constructionFloodlightAck.objectId !== 7002) {
    throw new Error(`Construction-floodlight light control failed: ${JSON.stringify(constructionFloodlightAck)}`);
  }
  const constructionFloodlightPayload = handle.positions.get(7002);
  const constructionFloodlightBuffer = constructionFloodlightPayload?.buffer?.getBuffer?.();
  if (!constructionFloodlightBuffer || constructionFloodlightBuffer.readDoubleLE(0) !== 1) {
    throw new Error('Construction-floodlight light did not write value 1 to its own Object-ID.');
  }

  manager.handleCommand({
    type: 'homebase_v1.hangar.animation.set',
    commandId: 'round-hangar-close',
    title: 'VFR Multitool Homebase Round Hangar',
    state: 'closed',
    instanceId: 'hangar'
  });
  const closeHangarAck = await waitForAck(acks, 'homebase_v1.hangar.animation.set_ack');
  if (closeHangarAck.status !== 'ok' || closeHangarAck.state !== 'closed' || closeHangarAck.controlScope !== 'simobject' || closeHangarAck.objectId !== 7000) {
    throw new Error(`Hangar close command failed: ${JSON.stringify(closeHangarAck)}`);
  }
  const closePayload = handle.positions.get(7000);
  const closeBuffer = closePayload?.buffer?.getBuffer?.();
  if (!closeBuffer || closeBuffer.readDoubleLE(0) !== 1) throw new Error('Hangar close command did not write L:variable value 1 via RawBuffer.');

  manager.handleCommand({
    type: 'homebase_v1.hangar.animation.set',
    commandId: 'round-hangar-open',
    title: 'VFR Multitool Homebase Round Hangar',
    state: 'open',
    instanceId: 'hangar'
  });
  const openHangarAck = await waitForAck(acks, 'homebase_v1.hangar.animation.set_ack');
  if (openHangarAck.status !== 'ok' || openHangarAck.state !== 'open') throw new Error(`Hangar open command failed: ${JSON.stringify(openHangarAck)}`);
  const openPayload = handle.positions.get(7000);
  const openBuffer = openPayload?.buffer?.getBuffer?.();
  if (!openBuffer || openBuffer.readDoubleLE(0) !== 0) throw new Error('Hangar open command did not write L:variable value 0 via RawBuffer.');

  manager.handleCommand({ type: 'homebase_v1.door_automation.set', commandId: 'door-auto-off', enabled: false, resetManualOverrides: true });
  const automationOffAck = await waitForAck(acks, 'homebase_v1.door_automation.set_ack');
  if (automationOffAck.status !== 'ok' || automationOffAck.enabled !== false || automationOffAck.resetManualOverrides !== 1 || manager.snapshot().doorAutomationEnabled !== false) {
    throw new Error(`Door automation disable failed: ${JSON.stringify(automationOffAck)}`);
  }
  manager.handleCommand({ type: 'homebase_v1.door_automation.set', commandId: 'door-auto-on', enabled: true });
  const automationOnAck = await waitForAck(acks, 'homebase_v1.door_automation.set_ack');
  if (automationOnAck.status !== 'ok' || automationOnAck.enabled !== true) throw new Error('Door automation enable failed.');

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

  manager.handleCommand({
    type: 'homebase_v1.crew.set',
    commandId: 'crew-1',
    objects: [
      { id: 'crew-alpha-hangar', title: 'VFR Multitool Homebase Hangar', label: 'Alpha · Hangar', lat: 48.01, lon: 8.01, altFt: 514, heightOffsetFt: 0, heading: 90 },
      { id: 'crew-alpha-box', title: 'Cardboard', label: 'Alpha · Karton', lat: 48.01001, lon: 8.01001, altFt: 514, heightOffsetFt: 0, heading: 90 }
    ]
  });
  const crewAck = await waitForAck(acks, 'homebase_v1.crew.set_ack');
  if (crewAck.status !== 'ok' || crewAck.objectCount !== 2 || manager.snapshot().crewObjectCount !== 2) throw new Error('Crew scene set failed.');

  manager.handleCommand({ type: 'homebase_v1.preview.clear', commandId: 'clear-crew-isolated' });
  const isolatedClearAck = await waitForAck(acks, 'homebase_v1.preview.clear_ack');
  if (isolatedClearAck.status !== 'ok' || manager.snapshot().crewObjectCount !== 2) throw new Error('Preview clear removed crew objects.');

  manager.handleCommand({ type: 'homebase_v1.crew.set', commandId: 'crew-clear', objects: [] });
  const crewClearAck = await waitForAck(acks, 'homebase_v1.crew.set_ack');
  if (crewClearAck.status !== 'ok' || crewClearAck.objectCount !== 0 || manager.snapshot().objectCount !== 0) throw new Error('Crew scene clear failed.');

  const coldRouteCount = handle.waypointRoutes.length;
  const coldNavigation = {
    spawn: { lat: 48, lon: 8, altFt: 514, heading: 0 },
    hangar: { id: 'hangar', northM: -100, eastM: 0, heading: 0, widthM: 18, depthM: 22 },
    hangars: [
      { id: 'hangar', northM: -100, eastM: 0, heading: 0, widthM: 18, depthM: 22 },
      { id: 'round-hangar-15', northM: 0, eastM: 0, heading: 0, widthM: 18, depthM: 22 }
    ],
    obstacles: [
      { id: 'round-hangar-15-wall-back', northM: -11, eastM: 0, heading: 0, widthM: 18, depthM: .3 },
      { id: 'round-hangar-15-wall-left', northM: 0, eastM: -9, heading: 0, widthM: .3, depthM: 22 },
      { id: 'round-hangar-15-wall-right', northM: 0, eastM: 9, heading: 0, widthM: .3, depthM: 22 },
      { id: 'round-hangar-15-wall-front-left', northM: 11, eastM: -5.75, heading: 0, widthM: 6.5, depthM: .3 },
      { id: 'round-hangar-15-wall-front-right', northM: 11, eastM: 5.75, heading: 0, widthM: 6.5, depthM: .3 },
      { id: 'toolbox-16', northM: 0, eastM: 0, heading: 0, widthM: .8, depthM: .45 }
    ]
  };
  manager.handleCommand({
    type: 'homebase_v1.preview.people.sync', commandId: 'people-cold-start',
    navigation: coldNavigation,
    people: [{
      id: 'person-cold', title: 'Tarmac_Male_Summer_Asian', label: 'Kaltstart-Person',
      startNorthM: 14, startEastM: 0, speedKts: 2.6,
      destinations: [{ id: 'cold-toolbox', targetType: 'object', targetId: 'toolbox-16', waitMinS: 1, waitMaxS: 2 }]
    }]
  });
  const coldStartAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  if (coldStartAck.status !== 'ok' || coldStartAck.spawnedPeople.length !== 1 || manager.snapshot().objects.find((item) => item.id === 'person-cold') == null) {
    throw new Error(`Homebase people cold-start sync failed: ${JSON.stringify(coldStartAck)}`);
  }
  await waitForCondition(() => handle.waypointRoutes.length >= coldRouteCount + 1);
  manager.handleCommand({
    type: 'homebase_v1.preview.people.sync', commandId: 'people-cold-clear',
    navigation: coldNavigation, people: []
  });
  const coldClearAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  if (coldClearAck.status !== 'ok' || coldClearAck.removedPeople.length !== 1 || manager.snapshot().objects.some((item) => item.id === 'person-cold')) {
    throw new Error(`Homebase people cold-start clear failed: ${JSON.stringify(coldClearAck)}`);
  }

  const skipRouteCount = handle.waypointRoutes.length;
  const skipNavigation = {
    spawn: { lat: 48, lon: 8, altFt: 514, heading: 0 },
    obstacles: [
      { id: 'blocked-object', northM: 20, eastM: 0, heading: 0, widthM: 1, depthM: 1 },
      { id: 'blocked-wall-north', northM: 24, eastM: 0, heading: 0, widthM: 8, depthM: .5 },
      { id: 'blocked-wall-south', northM: 16, eastM: 0, heading: 0, widthM: 8, depthM: .5 },
      { id: 'blocked-wall-west', northM: 20, eastM: -4, heading: 0, widthM: .5, depthM: 8 },
      { id: 'blocked-wall-east', northM: 20, eastM: 4, heading: 0, widthM: .5, depthM: 8 }
    ]
  };
  manager.handleCommand({
    type: 'homebase_v1.preview.people.sync', commandId: 'people-random-skip-unreachable',
    navigation: skipNavigation,
    people: [{
      id: 'person-skip', title: 'Tarmac_Male_Summer_Asian', label: 'Zufallsziel-Test',
      startNorthM: 0, startEastM: 0, speedKts: 2.6, targetMode: 'all-objects',
      destinations: [
        { id: 'auto-blocked', targetType: 'object', targetId: 'blocked-object', waitMinS: 1, waitMaxS: 1 },
        { id: 'auto-reachable', targetType: 'waypoint', northM: 4, eastM: 0, waitMinS: 3600, waitMaxS: 3600 }
      ]
    }]
  });
  const skipAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  if (skipAck.status !== 'ok' || skipAck.spawnedPeople.length !== 1) throw new Error(`Random-target skip setup failed: ${JSON.stringify(skipAck)}`);
  await waitForCondition(() => logs.some((entry) => entry.includes('HOMEBASE_PERSON_ROUTE_SKIP id=person-skip target=auto-blocked')), 1500);
  await waitForCondition(() => handle.waypointRoutes.length > skipRouteCount, 1500);
  manager.handleCommand({ type: 'homebase_v1.preview.people.sync', commandId: 'people-random-skip-clear', navigation: skipNavigation, people: [] });
  const skipClearAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  if (skipClearAck.status !== 'ok' || manager.snapshot().objects.some((item) => item.id === 'person-skip')) throw new Error('Random-target skip cleanup failed.');

  manager.handleCommand({
    type: 'homebase_v1.preview.set', commandId: 'people-routes-1', objects: [],
    navigation: { spawn: { lat: 48, lon: 8, altFt: 514, heading: 90 }, obstacles: [] },
    people: [{
      id: 'person-1', title: 'Tarmac_Male_Summer_Asian', label: 'Mitarbeiter 1',
      startNorthM: 0, startEastM: 0, speedKts: 2.6,
      destinations: [{ id: 'waypoint-1', targetType: 'waypoint', northM: 4, eastM: 0, waitMinS: 1, waitMaxS: 2 }]
    }]
  });
  const peopleAck = await waitForAck(acks, 'homebase_v1.preview.set_ack');
  if (peopleAck.status !== 'ok' || peopleAck.peopleCount !== 1 || peopleAck.objectCount !== 1 || handle.waypointRoutes.length < 1) {
    throw new Error(`Homebase people route setup failed: ${JSON.stringify(peopleAck)}`);
  }
  const personObjectId = manager.snapshot().objects.find((item) => item.id === 'person-1')?.objectId;
  const routeCountBeforeUpdate = handle.waypointRoutes.length;
  manager.handleCommand({
    type: 'homebase_v1.preview.people.sync', commandId: 'people-routes-live-update',
    navigation: { spawn: { lat: 48, lon: 8, altFt: 514, heading: 90 }, obstacles: [] },
    people: [{
      id: 'person-1', title: 'Tarmac_Male_Summer_Asian', label: 'Mitarbeiter 1',
      startNorthM: 0, startEastM: 0, speedKts: 3,
      destinations: [{ id: 'waypoint-2', targetType: 'waypoint', northM: 0, eastM: 6, waitMinS: 1, waitMaxS: 2 }]
    }]
  });
  const peopleUpdateAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  const updatedPersonObjectId = manager.snapshot().objects.find((item) => item.id === 'person-1')?.objectId;
  if (peopleUpdateAck.status !== 'ok' || peopleUpdateAck.spawnedPeople.length !== 0 || peopleUpdateAck.updatedPeople.length !== 1
    || updatedPersonObjectId !== personObjectId || handle.waypointRoutes.length <= routeCountBeforeUpdate) {
    throw new Error(`Homebase people route live update respawned the person or did not replace its route: ${JSON.stringify(peopleUpdateAck)}`);
  }

  manager.handleCommand({
    type: 'homebase_v1.preview.people.sync', commandId: 'people-model-alias-swap',
    navigation: { spawn: { lat: 48, lon: 8, altFt: 514, heading: 90 }, obstacles: [] },
    people: [{
      id: 'person-1', title: 'Tarmac_Male_Summer_Black', label: 'Mitarbeiter 1',
      startNorthM: 0, startEastM: 0, speedKts: 3, destinations: []
    }]
  });
  const aliasSwapAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  const aliasedPerson = manager.snapshot().objects.find((item) => item.id === 'person-1');
  if (aliasSwapAck.status !== 'ok' || aliasedPerson?.title !== 'Tarmac_Male_Summer_African'
    || aliasedPerson.objectId === updatedPersonObjectId || manager.snapshot().objectCount !== 1) {
    throw new Error(`Legacy Homebase person title was not migrated safely: ${JSON.stringify(aliasSwapAck)}`);
  }

  handle.failedTitles.add('Tarmac_Female_Winter_Asian');
  manager.handleCommand({
    type: 'homebase_v1.preview.people.sync', commandId: 'people-model-swap-failure',
    navigation: { spawn: { lat: 48, lon: 8, altFt: 514, heading: 90 }, obstacles: [] },
    people: [{
      id: 'person-1', title: 'Tarmac_Female_Winter_Asian', label: 'Mitarbeiter 1',
      startNorthM: 0, startEastM: 0, speedKts: 3, destinations: []
    }]
  });
  const failedSwapAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  handle.failedTitles.delete('Tarmac_Female_Winter_Asian');
  const preservedPerson = manager.snapshot().objects.find((item) => item.id === 'person-1');
  if (failedSwapAck.status !== 'error' || failedSwapAck.failedPeople?.length !== 1
    || preservedPerson?.title !== 'Tarmac_Male_Summer_African'
    || preservedPerson.objectId !== aliasedPerson.objectId || manager.snapshot().objectCount !== 1) {
    throw new Error(`Failed Homebase person replacement did not preserve the previous person: ${JSON.stringify(failedSwapAck)}`);
  }
  manager.handleCommand({ type: 'homebase_v1.preview.clear', commandId: 'people-routes-clear' });
  const peopleClearAck = await waitForAck(acks, 'homebase_v1.preview.clear_ack');
  if (peopleClearAck.status !== 'ok' || manager.snapshot().objectCount !== 0) throw new Error('Homebase people route clear failed.');

  catalog.registerRuntimeAssets([{
    key: 'collisionTest', folder: 'VFRHomebaseCollisionTest', title: 'VFR Multitool Homebase Collision Test',
    kind: 'object', group: 'Test', label: 'Collision Test', homebasePlaceable: true,
    collisionProfile: {
      schemaVersion: 1,
      mode: 'static-model-lib',
      modelLibGuid: '{29BB5A2A-1961-4947-BB68-BB6B12C33F4E}',
      sourceFolder: 'VFRHomebaseRoundHangarCollision',
      placement: 'coincident',
      groundSurface: 'continuous-terrain-apron-floor',
      defaultHeightOffsetFt: 0,
      warnOnHeightOffset: true
    }
  }]);
  const scene = createSceneXml({
    spawn: { lat: 48, lon: 8, altFt: 500, heading: 90 },
    hangar: { lat: 48, lon: 8, heading: 270, objectTitle: 'VFR Multitool Homebase Round Hangar' },
    objects: [
      { id: 'box', title: 'Cardboard', lat: 48, lon: 8, heightOffsetFt: 0, heading: 0, scale: 1 },
      { id: 'pallet', title: 'Pallet01_01', lat: 48.00001, lon: 8.00001, heightOffsetFt: 0, heading: 0, scale: 1 },
      { id: 'collision', title: 'VFR Multitool Homebase Collision Test', lat: 48.00002, lon: 8.00002, heightOffsetFt: 0, heading: 15, scale: 1 }
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
  if (!scene.content.includes('name="VegetationScale"') || !scene.content.includes('name="VegetationFalloff"')) throw new Error('Round-hangar vegetation exclusion missing.');
  if (scene.content.includes('name="FlattenMode"') || scene.content.includes('name="ForceElevation"')) throw new Error('Vegetation exclusion unexpectedly alters terrain elevation.');
  if (!scene.content.includes('<LibraryObject name="{29BB5A2A-1961-4947-BB68-BB6B12C33F4E}" scale="1.000"/>')) throw new Error('Static collision companion missing.');
  if (scene.config.compileMode !== 'full') throw new Error('Legacy Homebase builds must default to full mode.');

  const spawnOnlyScene = createSceneXml({
    ...scene.config,
    compileMode: 'spawn-only'
  });
  if (spawnOnlyScene.config.compileMode !== 'spawn-only') throw new Error('Spawn-only compile mode was not retained.');
  if (!spawnOnlyScene.content.includes('type="RAMP_GA_SMALL"')) throw new Error('Spawn-only Homebase parking missing.');
  if (spawnOnlyScene.content.includes('<SceneryObject') || spawnOnlyScene.content.includes('<Polygon')) {
    throw new Error('Spawn-only Homebase unexpectedly contains visual, collision, or vegetation scenery.');
  }
  if (spawnOnlyScene.config.objects.length !== scene.config.objects.length) {
    throw new Error('Spawn-only snapshot did not retain the editable Homebase plan.');
  }

  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'homebase-assets-test-'));
  try {
    const createZip = createTestZip;
    const entriesFromDirectory = testZipEntriesFromDirectory;
    const assetPackageSourcePath = process.env.VFR_HOMEBASE_ASSET_PACKAGE_SOURCE
      ? path.resolve(process.env.VFR_HOMEBASE_ASSET_PACKAGE_SOURCE)
      : createMinimalAssetPackageFixture(path.join(testRoot, 'source-fixture'));
    const appData = path.join(testRoot, 'AppData', 'Roaming');
    const localAppData = path.join(testRoot, 'AppData', 'Local');
    const fakeSteamCommunity = path.join(appData, 'Microsoft Flight Simulator 2024', 'Packages', 'Community');
    const storeLocalCache = path.join(localAppData, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache');
    const storePackages = path.join(testRoot, 'StorePackages');
    const storeCommunity = path.join(storePackages, 'Community');
    fs.mkdirSync(fakeSteamCommunity, { recursive: true });
    fs.mkdirSync(storeCommunity, { recursive: true });
    fs.mkdirSync(storeLocalCache, { recursive: true });
    fs.writeFileSync(path.join(storeLocalCache, 'UserCfg.opt'), `InstalledPackagesPath "${storePackages}"\n`, 'utf8');
    const initialRemoteRelease = createRemoteReleaseFixture({
      sourcePackage: assetPackageSourcePath,
      root: path.join(testRoot, 'initial-release'),
      version: remoteVersion,
      createZip,
      entriesFromDirectory
    });

    const storeDiscovery = discoverCommunityFolders({ appData, localAppData });
    if (storeDiscovery.entries.length !== 1 || path.resolve(storeDiscovery.entries[0].path) !== path.resolve(storeCommunity)) {
      throw new Error(`Store UserCfg path did not override the misleading Steam fallback: ${JSON.stringify(storeDiscovery)}`);
    }

    const steamAppData = path.join(testRoot, 'SteamAppData');
    const steamPackages = path.join(testRoot, 'SteamPackages');
    const steamCommunity = path.join(steamPackages, 'Community');
    const steamCommunity2024 = path.join(steamPackages, 'Community2024');
    const steamUserCfg = path.join(steamAppData, 'Microsoft Flight Simulator 2024', 'UserCfg.opt');
    fs.mkdirSync(path.dirname(steamUserCfg), { recursive: true });
    fs.mkdirSync(steamCommunity, { recursive: true });
    fs.mkdirSync(steamCommunity2024, { recursive: true });
    fs.writeFileSync(steamUserCfg, `InstalledPackagesPath "${steamPackages}"\n`, 'utf8');
    const steamDiscovery = discoverCommunityFolders({ appData: steamAppData, localAppData: path.join(testRoot, 'NoStore') });
    if (selectCommunityFolder(steamDiscovery) !== path.resolve(steamCommunity2024)) {
      throw new Error(`MSFS 2024 Community2024 was not preferred: ${JSON.stringify(steamDiscovery)}`);
    }
    let ambiguousRejected = false;
    try {
      selectCommunityFolder({ entries: [...storeDiscovery.entries, ...steamDiscovery.entries], error: '' });
    } catch (error) {
      ambiguousRejected = error?.code === 'COMMUNITY_AMBIGUOUS';
    }
    if (!ambiguousRejected) throw new Error('Multiple configured MSFS package roots were not rejected safely.');

    const missingUserCfg = path.join(testRoot, 'MissingConfig', 'UserCfg.opt');
    fs.mkdirSync(path.dirname(missingUserCfg), { recursive: true });
    fs.writeFileSync(missingUserCfg, `InstalledPackagesPath "${path.join(testRoot, 'MissingPackages')}"\n`, 'utf8');
    const missingDiscovery = discoverCommunityFolders({ appData, localAppData, userCfgFiles: [missingUserCfg] });
    if (missingDiscovery.entries.length || !missingDiscovery.error) {
      throw new Error('An invalid configured package path incorrectly fell back to an unrelated Community folder.');
    }

    const packageAcks = [];
    const packageService = createHomebasePackageService({
      runtimeDir: testRoot,
      appData,
      localAppData,
      assetChannelUrl: initialRemoteRelease.channelUrl,
      remoteRequestBuffer: initialRemoteRelease.requestBuffer,
      sendAck: (ack) => packageAcks.push(ack),
      isSimulatorRunning: () => false
    });
    if (!packageService.capabilities.includes('homebase-assets-install')) throw new Error('Asset install capability missing.');
    if (!packageService.capabilities.includes('homebase-assets-online-only-v1')) throw new Error('Online-only asset capability missing.');
    const embedded = packageService.inspectEmbeddedAssets();
    if (embedded.deliveryMode !== 'online-only' || embedded.embeddedAvailable || embedded.embeddedPackageComplete) {
      throw new Error(`Online-only asset inspection failed: ${JSON.stringify(embedded)}`);
    }
    const installed = await packageService.installAssets();
    if (installed.packageVersion !== remoteVersion || installed.source !== 'remote' || installed.unchanged) throw new Error('Remote-first asset installation failed.');
    if (path.resolve(installed.communityPath) !== path.resolve(storeCommunity) || fs.existsSync(path.join(fakeSteamCommunity, catalog.assetPackageName))) {
      throw new Error(`Store asset package was installed into the wrong Community folder: ${JSON.stringify(installed)}`);
    }
    const inspected = packageService.inspectAssets();
    if (!inspected.packageComplete || inspected.packageVersion !== remoteVersion) throw new Error('Installed asset validation failed.');
    const localAssetCatalog = packageService.inspectAssetState().assetCatalog;
    const localLantern = localAssetCatalog.find((asset) => asset.key === 'stableLantern');
    if (!localLantern?.controls?.some((control) => control.id === 'light'
      && control.simvar === 'L:1:VFR_HOMEBASE_STABLE_LANTERN_LIGHT_COMMAND')) {
      throw new Error('Locally installed package did not expose the built-in stable-lantern catalog to the app.');
    }
    const localConstructionFloodlight = localAssetCatalog.find((asset) => asset.key === 'constructionFloodlightTripod');
    if (!localConstructionFloodlight?.controls?.some((control) => control.id === 'light'
      && control.simvar === 'L:1:VFR_HOMEBASE_CONSTRUCTION_FLOODLIGHT_LIGHT_COMMAND')) {
      throw new Error('Locally installed package did not expose the built-in construction-floodlight catalog to the app.');
    }
    const repeated = await packageService.installAssets();
    if (!repeated.unchanged || repeated.source !== 'remote') throw new Error('Repeated online asset installation must be idempotent.');
    const sceneOutput = path.join(testRoot, 'homebase-generated', 'vfr-multitool-homebase', 'Packages', catalog.scenePackageName);
    fs.mkdirSync(sceneOutput, { recursive: true });
    fs.writeFileSync(path.join(sceneOutput, 'manifest.json'), '{"package_version":"0.5.0"}\n', 'utf8');
    fs.writeFileSync(path.join(sceneOutput, 'layout.json'), '{"content":[]}\n', 'utf8');
    fs.writeFileSync(path.join(path.dirname(path.dirname(sceneOutput)), 'homebase-config.json'), `${JSON.stringify(scene.config, null, 2)}\n`, 'utf8');
    packageService.handleCommand({ type: 'homebase_v1.package.install', commandId: 'scene-store-path', confirmed: true });
    const sceneInstallAck = await waitForAck(packageAcks, 'homebase_v1.package.install_ack');
    if (sceneInstallAck.status !== 'ok' || path.resolve(sceneInstallAck.communityPath) !== path.resolve(storeCommunity) || !sceneInstallAck.snapshotTrusted) {
      throw new Error(`Store scene package was installed into the wrong Community folder: ${JSON.stringify(sceneInstallAck)}`);
    }
    const sceneStatus = packageService.inspectInstalledScene();
    if (!sceneStatus.sceneInstalled || !sceneStatus.snapshotTrusted || sceneStatus.installedSnapshot?.config?.objects?.[0]?.id !== scene.config.objects[0].id) {
      throw new Error(`Installed Homebase snapshot was not retained: ${JSON.stringify(sceneStatus)}`);
    }
    if (!fs.existsSync(path.join(storeCommunity, catalog.scenePackageName)) || fs.existsSync(path.join(fakeSteamCommunity, catalog.scenePackageName))) {
      throw new Error('Compiled Homebase scene package did not follow the detected Store Community path.');
    }
    if (fs.existsSync(path.join(testRoot, 'homebase-generated'))
      || !fs.existsSync(path.join(testRoot, 'homebase-state', 'installed-homebase-state.json'))) {
      throw new Error('Temporary scene build data was not cleaned or persistent scene state was not retained.');
    }
    const interruptedBackup = `${installed.path}.__backup`;
    fs.renameSync(installed.path, interruptedBackup);
    if (fs.existsSync(installed.path) || !fs.existsSync(interruptedBackup)) throw new Error('Interrupted-install fixture could not be prepared.');

    const remoteRelease = createRemoteReleaseFixture({
      sourcePackage: assetPackageSourcePath,
      root: testRoot,
      version: remoteVersion,
      createZip,
      entriesFromDirectory,
      contentHashOverride: 'f'.repeat(64)
    });
    const remoteAcks = [];
    const remoteService = createHomebasePackageService({
      runtimeDir: path.join(testRoot, 'remote-runtime'),
      appData,
      localAppData,
      assetChannelUrl: remoteRelease.channelUrl,
      remoteRequestBuffer: remoteRelease.requestBuffer,
      remoteCacheTtlMs: 1,
      sendAck: (ack) => remoteAcks.push(ack),
      isSimulatorRunning: () => false
    });
    if (!remoteService.capabilities.includes('homebase-assets-remote-update')) throw new Error('Remote asset update capability missing.');
    const remoteStatus = await remoteService.checkRemoteAssets({ force: true });
    if (!remoteStatus.remoteAvailable || !remoteStatus.updateAvailable || remoteStatus.remoteVersion !== remoteVersion) {
      throw new Error(`Remote asset check failed: ${JSON.stringify(remoteStatus)}`);
    }
    if (!remoteRelease.requestedUrls.some((url) => new URL(url).searchParams.has('_vfrcb'))) {
      throw new Error('Forced remote asset check did not bypass intermediary caches.');
    }
    if (!Array.isArray(remoteStatus.remoteAssets) || remoteStatus.remoteAssets.length !== catalog.assets.length) {
      throw new Error('Remote asset catalog was not exposed to the app.');
    }
    if (remoteStatus.remoteAssets.find((asset) => asset.key === 'generator')?.workbenchVisible !== false) {
      throw new Error('Remote workbench visibility was not exposed to the app.');
    }
    if (!remoteStatus.remoteAssets.find((asset) => asset.key === 'roundHangar')?.controls?.some((control) => control.id === 'door')) {
      throw new Error('Remote object controls were not exposed to the app.');
    }
    const remoteInstalled = await remoteService.installRemoteAssets();
    if (remoteInstalled.packageVersion !== remoteVersion || remoteInstalled.source !== 'remote' || remoteInstalled.unchanged) {
      throw new Error(`Remote asset installation failed: ${JSON.stringify(remoteInstalled)}`);
    }
    const remoteInspection = remoteService.inspectAssets();
    if (!remoteInspection.packageComplete || remoteInspection.packageVersion !== remoteVersion) throw new Error('Remote package inspection failed.');
    if (fs.existsSync(interruptedBackup)) throw new Error('Interrupted package backup was not recovered and cleaned.');
    const activeIndexPath = path.join(testRoot, 'remote-runtime', 'homebase-state', 'active-package-index.json');
    if (!fs.existsSync(activeIndexPath) || JSON.parse(fs.readFileSync(activeIndexPath, 'utf8')).packageVersion !== remoteVersion) {
      throw new Error('Active remote package index was not persisted.');
    }
    if (fs.existsSync(path.join(testRoot, 'remote-runtime', 'homebase-asset-cache'))) {
      throw new Error('Temporary remote asset cache was not removed after installation.');
    }
    const activeCatalog = remoteService.inspectAssetState().assetCatalog;
    if (!Array.isArray(activeCatalog) || activeCatalog.length !== catalog.assets.length) {
      throw new Error('Installed asset catalog was not restored from the active package index.');
    }
    if (activeCatalog.find((asset) => asset.key === 'generator')?.workbenchVisible !== false) {
      throw new Error('Installed workbench visibility was not restored from the active package index.');
    }
    const activeRoundHangar = activeCatalog.find((asset) => asset.key === 'roundHangar');
    if (activeRoundHangar?.headingCorrectionDeg !== 0 || !activeRoundHangar?.controls?.some((control) => control.id === 'door') || activeRoundHangar?.vegetationExclusion?.shape !== 'circle') {
      throw new Error('Installed round-hangar runtime metadata was not restored from the active package index.');
    }
    const noDowngrade = await remoteService.installAssets();
    if (!noDowngrade.unchanged || noDowngrade.packageVersion !== remoteVersion || noDowngrade.source !== 'remote') throw new Error('Online compatibility install changed the current remote package.');

    remoteService.handleCommand({ type: 'homebase_v1.assets.update.install', commandId: 'remote-no-confirm' });
    const confirmationAck = await waitForAck(remoteAcks, 'homebase_v1.assets.update.install_ack');
    if (confirmationAck.status !== 'error' || confirmationAck.code !== 'CONFIRMATION_REQUIRED') throw new Error('Remote install confirmation guard failed.');

    const badHashRelease = createRemoteReleaseFixture({
      sourcePackage: assetPackageSourcePath,
      root: testRoot,
      version: nextRemoteVersion,
      createZip,
      entriesFromDirectory,
      archiveHashOverride: '0'.repeat(64)
    });
    const badHashService = createHomebasePackageService({
      runtimeDir: path.join(testRoot, 'bad-hash-runtime'),
      appData,
      localAppData,
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
    if (!hashRejected || badHashService.inspectAssets().packageVersion !== remoteVersion) throw new Error('Hash rejection did not preserve the installed package.');

    const rollbackRelease = createRemoteReleaseFixture({
      sourcePackage: assetPackageSourcePath,
      root: testRoot,
      version: nextRemoteVersion,
      createZip,
      entriesFromDirectory
    });
    const rollbackService = createHomebasePackageService({
      runtimeDir: path.join(testRoot, 'rollback-runtime'),
      appData,
      localAppData,
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
    if (!rollbackRejected || rollbackService.inspectAssets().packageVersion !== remoteVersion) throw new Error('Atomic rollback failed to restore the previous package.');

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
