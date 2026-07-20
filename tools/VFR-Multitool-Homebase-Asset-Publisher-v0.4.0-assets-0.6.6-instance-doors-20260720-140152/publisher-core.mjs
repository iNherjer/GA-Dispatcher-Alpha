import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createZip, entriesFromDirectory } from './zip-utils.mjs';
import visibilityPolicy from './asset-visibility-policy.js';

const DEFAULT_SDK = 'C:\\MSFS 2024 SDK\\Tools\\bin\\fspackagetool.exe';
const PRODUCTION_PACKAGE_NAME = 'vfr-multitool-homebase-assets';
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9-]{1,62}$/;
const SAFE_FOLDER = /^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/;
const SAFE_CONTROL_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_GLOBAL_LVAR = /^L:VFR_HOMEBASE_[A-Z0-9_]+$/;
const SAFE_SIMOBJECT_VAR = /^(?:L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]+$/;
const GUID = /^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/i;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SIDECAR_NAME = 'homebase-asset.json';
const VEGETATION_SCALE_GUID = '{6A043F59-E6F2-4117-A2E4-D510E7317C29}';
const VEGETATION_DENSITY_GUID = '{41EFF715-C392-4B31-A457-50A504353A90}';
const VEGETATION_FALLOFF_GUID = '{E82ABE17-FB4C-4F67-A28C-ED41969AEAD6}';

function jsonRead(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function jsonWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function copyTree(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) copyTree(path.join(source, entry), path.join(target, entry));
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function walkFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  };
  walk(root);
  return files;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function fileRecords(root, relativeFiles = walkFiles(root)) {
  return relativeFiles.map((relative) => {
    const absolute = path.join(root, ...relative.split('/'));
    return { path: relative, size: fs.statSync(absolute).size, sha256: sha256File(absolute) };
  });
}

function contentHash(files) {
  return sha256Text(files.map((file) => `${file.path}:${file.size}:${file.sha256}`).join('\n'));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function assetMetadata(asset = {}) {
  const ignored = new Set(['updatedAt', 'contentHash', 'modelHash', 'metadataHash', 'changed', 'files', 'archive']);
  return stableValue(Object.fromEntries(Object.entries(asset).filter(([key]) => !ignored.has(key))));
}

export function assetMetadataHash(asset = {}) {
  return sha256Text(JSON.stringify(assetMetadata(asset)));
}

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: options.timeoutMs || 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.error && !options.allowFailure) throw result.error;
  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    const error = new Error(`${command} ${args.join(' ')} fehlgeschlagen${output ? `:\n${output}` : '.'}`);
    error.exitCode = result.status;
    throw error;
  }
  return { ok: (result.status ?? 1) === 0, status: result.status, output };
}

function isSimulatorRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const output = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq FlightSimulator2024.exe', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8', windowsHide: true, timeout: 10000
    });
    return output.toLowerCase().includes('flightsimulator2024.exe');
  } catch (_) {
    return false;
  }
}

function parseRepoSlug(remoteUrl) {
  const value = String(remoteUrl || '').trim().replace(/\.git$/i, '');
  const match = value.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  return match ? `${match[1]}/${match[2]}` : '';
}

function safeVersion(value) {
  const version = String(value || '').trim();
  if (!VERSION.test(version)) throw new Error(`UngÃ¼ltige Version: ${value}. Erwartet wird zum Beispiel 0.5.7.`);
  return version;
}

export function nextPatchVersion(value) {
  const version = safeVersion(value);
  const [major, minor, patch] = version.split(/[+-]/, 1)[0].split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function versionIsGreater(candidate, current) {
  const left = safeVersion(candidate).split(/[+-]/, 1)[0].split('.').map(Number);
  const right = safeVersion(current).split(/[+-]/, 1)[0].split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return candidate !== current && !String(candidate).includes('-');
}

function assertProductionCatalog(catalog) {
  const actual = String(catalog?.package?.name || '');
  if (actual !== PRODUCTION_PACKAGE_NAME) {
    throw new Error(`Produktionsbuild gesperrt: Paketname muss exakt ${PRODUCTION_PACKAGE_NAME} sein (aktuell: ${actual || '(leer)'}).`);
  }
}

function toAssetKey(folder) {
  return String(folder || '')
    .replace(/^VFRHomebase/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'new-asset';
}

function sourceSuggestion(folder, title) {
  const words = `${folder} ${title}`.toLowerCase();
  const cargo = /(briefcase|suitcase|trolley|case|crate|cargo|luggage)/.test(words);
  const hangar = /hangar/.test(words);
  return {
    key: toAssetKey(folder), folder, title,
    label: String(title || folder).replace(/^VFR Multitool Homebase\s*/i, '') || folder,
    homebasePlaceable: true,
    workbenchVisible: true,
    version: '1.0.0', kind: hangar ? 'hangar' : 'object', group: hangar ? 'Hangars' : (cargo ? 'Gepäck & Fracht' : 'Ausstattung'),
    missionSpawnable: !hangar,
    missionTags: hangar ? ['homebase', 'hangar', 'shelter'] : (cargo ? ['cargo', 'luggage', 'supplies'] : ['homebase']),
    missionRoles: hangar ? ['scene-prop'] : (cargo ? ['cargo', 'scene-prop'] : ['scene-prop'])
  };
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} muss eine endliche Zahl sein.`);
  return number;
}

export function normalizeControl(raw = {}) {
  const id = String(raw.id || '').trim();
  const type = String(raw.type || '').trim().toLowerCase();
  const label = String(raw.label || '').trim();
  const transport = String(raw.transport || 'simconnect-lvar').trim().toLowerCase();
  const simvar = String(raw.simvar || '').trim();
  const unit = String(raw.unit || 'number').trim().toLowerCase();
  const scope = String(raw.scope || 'global').trim().toLowerCase();
  if (!SAFE_CONTROL_ID.test(id)) throw new Error(`Control-ID „${id || '(leer)'}“ enthält ungültige Zeichen.`);
  if (!['animation', 'light'].includes(type)) throw new Error(`Control ${id}: Typ muss animation oder light sein.`);
  if (!label) throw new Error(`Control ${id}: Label darf nicht leer sein.`);
  if (transport !== 'simconnect-lvar') throw new Error(`Control ${id}: Nur simconnect-lvar wird unterstützt.`);
  if (!['global', 'simobject'].includes(scope)) throw new Error(`Control ${id}: Scope muss global oder simobject sein.`);
  if (scope === 'global' && !SAFE_GLOBAL_LVAR.test(simvar)) {
    throw new Error(`Control ${id}: Globale LVar muss mit L:VFR_HOMEBASE_ beginnen und darf nur sichere Großbuchstaben/Ziffern enthalten.`);
  }
  if (scope === 'simobject' && !SAFE_SIMOBJECT_VAR.test(simvar)) {
    throw new Error(`Control ${id}: Objektlokale Variable muss mit L:1:VFR_HOMEBASE_ oder Z:VFR_HOMEBASE_ beginnen und darf nur sichere Großbuchstaben/Ziffern enthalten.`);
  }
  if (unit !== 'number') throw new Error(`Control ${id}: unit muss number sein.`);
  const states = (Array.isArray(raw.states) ? raw.states : []).map((state) => ({
    id: String(state?.id || '').trim(),
    label: String(state?.label || '').trim(),
    value: finiteNumber(state?.value, `Control ${id}, Zustand ${state?.id || '(leer)'}`)
  }));
  if (states.length < 2) throw new Error(`Control ${id}: Mindestens zwei Zustände sind erforderlich.`);
  const stateIds = new Set();
  for (const state of states) {
    if (!SAFE_CONTROL_ID.test(state.id)) throw new Error(`Control ${id}: Zustands-ID „${state.id || '(leer)'}“ ist ungültig.`);
    if (!state.label) throw new Error(`Control ${id}: Zustand ${state.id} braucht ein Label.`);
    if (stateIds.has(state.id)) throw new Error(`Control ${id}: Zustands-ID ${state.id} ist doppelt.`);
    stateIds.add(state.id);
  }
  if (new Set(states.map((state) => state.value)).size < 2) throw new Error(`Control ${id}: Mindestens zwei unterschiedliche Zustandswerte sind erforderlich.`);
  const defaultState = String(raw.defaultState || states[0].id).trim();
  if (!stateIds.has(defaultState)) throw new Error(`Control ${id}: Standardzustand ${defaultState} ist nicht definiert.`);
  const durationMs = raw.durationMs == null || raw.durationMs === '' ? undefined : finiteNumber(raw.durationMs, `Control ${id}, Dauer`);
  if (durationMs !== undefined && durationMs <= 0) throw new Error(`Control ${id}: Dauer muss größer als 0 ms sein.`);
  return {
    ...raw,
    schemaVersion: 1,
    id,
    type,
    label,
    transport,
    simvar,
    unit,
    scope,
    defaultState,
    ...(durationMs === undefined ? {} : { durationMs }),
    states
  };
}

export function legacyAnimationToControl(animation) {
  if (!animation || animation.type !== 'door') return null;
  const values = animation.control?.values || {};
  return normalizeControl({
    schemaVersion: 1,
    id: 'door',
    type: 'animation',
    label: animation.label || 'Tor',
    transport: animation.control?.transport || 'simconnect-lvar',
    simvar: animation.control?.simvar,
    unit: animation.control?.unit || 'number',
    scope: animation.control?.scope || 'global',
    defaultState: animation.defaultState || 'open',
    durationMs: animation.durationMs,
    states: [
      { id: 'open', label: 'Öffnen', value: values.open },
      { id: 'closed', label: 'Schließen', value: values.closed }
    ]
  });
}

function legacyAnimationFromControls(controls) {
  const door = controls.find((control) => control.id === 'door' && control.type === 'animation')
    || controls.find((control) => control.type === 'animation' && control.states.some((state) => state.id === 'open') && control.states.some((state) => state.id === 'closed'));
  if (!door) return null;
  const values = Object.fromEntries(door.states.map((state) => [state.id, state.value]));
  return {
    schemaVersion: 1,
    type: 'door',
    durationMs: door.durationMs,
    control: { transport: door.transport, simvar: door.simvar, unit: door.unit, scope: door.scope, values: { open: values.open, closed: values.closed } },
    defaultState: door.defaultState
  };
}

export function controlsFromAsset(asset = {}) {
  const rawControls = Array.isArray(asset.controls) ? asset.controls : [];
  const controls = rawControls.length ? rawControls.map(normalizeControl) : [];
  if (!controls.length && asset.animation?.type === 'door') controls.push(legacyAnimationToControl(asset.animation));
  const ids = new Set();
  for (const control of controls) {
    if (ids.has(control.id)) throw new Error(`Control-ID ${control.id} ist doppelt.`);
    ids.add(control.id);
  }
  return controls;
}

function normalizeCollisionProfile(raw) {
  if (raw == null) return null;
  const modelLibGuid = String(raw.modelLibGuid || '').trim().toUpperCase();
  if (!GUID.test(modelLibGuid)) throw new Error('Collision-Profil benötigt einen gültigen ModelLib-GUID in geschweiften Klammern.');
  const sourceFolder = String(raw.sourceFolder || '').trim();
  if (!SAFE_FOLDER.test(sourceFolder)) throw new Error('Collision-Profil benötigt einen sicheren ModelLib-Quellordner.');
  const defaultHeightOffsetFt = finiteNumber(raw.defaultHeightOffsetFt ?? 0, 'Collision-Standardhöhe');
  return {
    ...raw,
    schemaVersion: 1,
    mode: 'static-model-lib',
    modelLibGuid,
    sourceFolder,
    placement: 'coincident',
    defaultHeightOffsetFt,
    warnOnHeightOffset: raw.warnOnHeightOffset !== false
  };
}

function normalizeVegetationExclusion(raw) {
  if (raw == null) return null;
  if (raw.flattenMode != null || raw.forceElevation === true || raw.terrainAdjustment && raw.terrainAdjustment !== 'none') {
    throw new Error('Vegetationsausschluss darf weder FlattenMode noch ForceElevation oder Geländeverschiebung verwenden.');
  }
  const radiusM = finiteNumber(raw.radiusM, 'Vegetationsradius');
  const segments = Math.trunc(finiteNumber(raw.segments ?? 48, 'Vegetationspolygon-Segmente'));
  const falloffM = finiteNumber(raw.falloffM ?? 0.5, 'Vegetations-Falloff');
  if (radiusM <= 0 || radiusM > 200) throw new Error('Vegetationsradius muss zwischen 0 und 200 m liegen.');
  if (segments < 12 || segments > 256) throw new Error('Vegetationspolygon braucht 12 bis 256 Segmente.');
  if (falloffM < 0 || falloffM > 20) throw new Error('Vegetations-Falloff muss zwischen 0 und 20 m liegen.');
  return {
    ...raw,
    schemaVersion: 1,
    shape: 'circle',
    radiusM,
    segments,
    vegetationScale: 0,
    vegetationDensity: 0,
    falloffM,
    terrainAdjustment: 'none',
    attributes: [
      { name: 'VegetationScale', guid: VEGETATION_SCALE_GUID, type: 'UINT32', value: 0 },
      { name: 'VegetationDensity', guid: VEGETATION_DENSITY_GUID, type: 'UINT32', value: 0 },
      { name: 'VegetationFalloff', guid: VEGETATION_FALLOFF_GUID, type: 'FLOAT32', value: falloffM }
    ]
  };
}

function inspectSourceFolder(folderPath, catalog) {
  const folder = path.basename(folderPath);
  const simCfgPath = path.join(folderPath, 'sim.cfg');
  const modelRoot = path.join(folderPath, 'model');
  const result = { sourcePath: folderPath, folder, valid: false, errors: [], gltfFiles: [], sidecarPath: '', sidecar: null };
  if (!fs.existsSync(simCfgPath)) result.errors.push('sim.cfg fehlt');
  if (!fs.existsSync(modelRoot) || !fs.statSync(modelRoot).isDirectory()) result.errors.push('model-Ordner fehlt');
  if (result.errors.length) return result;
  const simCfg = fs.readFileSync(simCfgPath, 'utf8');
  const title = simCfg.match(/^title\s*=\s*(.+)$/mi)?.[1]?.trim();
  if (!title) result.errors.push('SimObject-Titel in sim.cfg fehlt');
  result.gltfFiles = fs.readdirSync(modelRoot).filter((name) => name.toLowerCase().endsWith('.gltf'));
  if (!result.gltfFiles.length) result.errors.push('Keine glTF-Datei im model-Ordner gefunden');
  let optimized = false;
  for (const name of result.gltfFiles) {
    const document = jsonRead(path.join(modelRoot, name));
    if (!document) result.errors.push(`${name} ist keine lesbare glTF-Datei`);
    if (document?.extensionsUsed?.includes('ASOBO_asset_optimized')) optimized = true;
  }
  if (optimized) result.errors.push('Enthält bereits kompiliertes ASOBO-Modell; es wird eine rohe SDK-Quelle benötigt');
  result.title = title || '';
  result.optimized = optimized;
  const suggested = sourceSuggestion(folder, result.title);
  const existing = catalog.assets.find((asset) => asset.folder.toLowerCase() === folder.toLowerCase()
    || asset.title.toLowerCase() === result.title.toLowerCase()
    || asset.key.toLowerCase() === suggested.key.toLowerCase());
  const sidecarPath = path.join(folderPath, SIDECAR_NAME);
  let sidecar = null;
  if (fs.existsSync(sidecarPath)) {
    sidecar = jsonRead(sidecarPath);
    result.sidecarPath = sidecarPath;
    result.sidecar = sidecar;
    if (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar)) result.errors.push(`${SIDECAR_NAME} ist kein gültiges JSON-Objekt`);
  }
  try {
    result.suggested = safeAsset({ ...suggested, ...(existing || {}), ...(sidecar || {}) }, existing || {});
    if (existing) result.suggested.version = nextPatchVersion(existing.version);
  } catch (error) {
    result.errors.push(`${SIDECAR_NAME}: ${error.message}`);
    result.suggested = { ...suggested, ...(existing || {}), ...(sidecar || {}) };
  }
  result.existingKey = existing?.key || '';
  result.existingVersion = existing?.version || '';
  result.suggestedVersion = result.suggested?.version || '';
  result.isReplacement = Boolean(existing);
  result.valid = result.errors.length === 0;
  return result;
}

export function safeAsset(input, existing = {}) {
  const key = String(input.key || existing.key || '').trim();
  const folder = String(input.folder || existing.folder || '').trim();
  const title = String(input.title || existing.title || '').trim();
  const label = String(input.label || existing.label || title).trim();
  const version = safeVersion(input.version || existing.version || '1.0.0');
  const kind = String(input.kind || existing.kind || 'object').trim().toLowerCase();
  if (!SAFE_KEY.test(key)) throw new Error('Asset-Key muss 2â€“63 Zeichen aus Buchstaben, 0â€“9 und Bindestrichen enthalten.');
  if (!SAFE_FOLDER.test(folder)) throw new Error('SimObject-Ordner enthÃ¤lt ungÃ¼ltige Zeichen.');
  if (!title || title.length > 160) throw new Error('SimObject-Titel fehlt oder ist zu lang.');
  if (!['object', 'hangar', 'internal'].includes(kind)) throw new Error('Asset-Typ muss object, hangar oder internal sein.');
  const rawMissionTags = input.missionTags === undefined ? existing.missionTags : input.missionTags;
  const rawMissionRoles = input.missionRoles === undefined ? existing.missionRoles : input.missionRoles;
  const missionTags = [...new Set((Array.isArray(rawMissionTags) ? rawMissionTags : String(rawMissionTags || '').split(','))
    .map((item) => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, 24);
  const missionRoles = [...new Set((Array.isArray(rawMissionRoles) ? rawMissionRoles : String(rawMissionRoles || '').split(','))
    .map((item) => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  const homebasePlaceable = input.homebasePlaceable === undefined
    ? existing.homebasePlaceable
    : input.homebasePlaceable !== false;
  const workbenchVisible = input.workbenchVisible === undefined
    ? existing.workbenchVisible !== false
    : input.workbenchVisible !== false;
  const rawAnimation = input.animation === undefined ? existing.animation : input.animation;
  const rawControls = input.controls === undefined ? existing.controls : input.controls;
  let controls = controlsFromAsset({
    controls: Array.isArray(rawControls) ? rawControls : [],
    animation: Array.isArray(rawControls) && rawControls.length ? null : rawAnimation
  });
  if (input.controls !== undefined && Array.isArray(input.controls) && input.controls.length === 0) controls = [];
  if (controls.length && !['hangar', 'object'].includes(kind)) throw new Error('Controls sind nur für kind=hangar und kind=object erlaubt.');
  const animation = legacyAnimationFromControls(controls);
  const rawFootprint = input.footprint === undefined ? existing.footprint : input.footprint;
  const footprint = rawFootprint == null ? undefined : visibilityPolicy.normalizeFootprint(rawFootprint);
  if (rawFootprint != null && !footprint) throw new Error('Footprint braucht eine Breite und Tiefe zwischen 1 und 200 m.');
  const headingCorrectionDeg = ((finiteNumber(input.headingCorrectionDeg ?? existing.headingCorrectionDeg ?? 0, 'Heading-Korrektur') % 360) + 360) % 360;
  const collisionProfile = normalizeCollisionProfile(input.collisionProfile === undefined ? existing.collisionProfile : input.collisionProfile);
  const vegetationExclusion = normalizeVegetationExclusion(input.vegetationExclusion === undefined ? existing.vegetationExclusion : input.vegetationExclusion);
  return visibilityPolicy.normalizeAssetEntry({
    ...existing,
    key,
    folder,
    title,
    label,
    version,
    kind,
    group: String(input.group || existing.group || 'Ausstattung'),
    ...(homebasePlaceable === undefined ? {} : { homebasePlaceable }),
    workbenchVisible,
    missionSpawnable: kind === 'hangar' ? false : (input.missionSpawnable === undefined ? existing.missionSpawnable === true : input.missionSpawnable === true),
    missionTags,
    missionRoles,
    controls,
    animation: animation || null,
    footprint: footprint || null,
    headingCorrectionDeg,
    collisionProfile,
    vegetationExclusion,
    updatedAt: new Date().toISOString()
  });
}

function validateSourceAsset(sourceRoot, asset, options = {}) {
  const simCfgPath = path.join(sourceRoot, 'sim.cfg');
  const modelRoot = path.join(sourceRoot, 'model');
  if (!fs.existsSync(simCfgPath) || !fs.statSync(simCfgPath).isFile()) throw new Error(`sim.cfg fehlt fÃ¼r ${asset.folder}.`);
  if (!fs.existsSync(modelRoot) || !fs.statSync(modelRoot).isDirectory()) throw new Error(`model-Ordner fehlt fÃ¼r ${asset.folder}.`);
  const simCfg = fs.readFileSync(simCfgPath, 'utf8');
  const title = simCfg.match(/^title\s*=\s*(.+)$/mi)?.[1]?.trim();
  if (title !== asset.title) throw new Error(`Titelabweichung fÃ¼r ${asset.folder}: Katalog â€ž${asset.title}â€œ, sim.cfg â€ž${title || '(fehlt)'}â€œ.`);
  const gltfFiles = fs.readdirSync(modelRoot).filter((name) => name.toLowerCase().endsWith('.gltf'));
  if (!gltfFiles.length) throw new Error(`glTF-Modell fehlt fÃ¼r ${asset.folder}.`);
  let optimized = false;
  for (const name of gltfFiles) {
    const gltfPath = path.join(modelRoot, name);
    if (fs.statSync(gltfPath).size === 0) throw new Error(`glTF-Datei ist leer für ${asset.folder}: ${name}.`);
    const document = jsonRead(gltfPath);
    if (!document?.asset?.version || !Array.isArray(document.buffers)) {
      throw new Error(`glTF-Datei ist ungültig für ${asset.folder}: ${name}.`);
    }
    for (const buffer of document.buffers) {
      const uri = String(buffer?.uri || '');
      if (!uri || uri.startsWith('data:')) continue;
      const bufferPath = path.join(modelRoot, uri);
      if (!fs.existsSync(bufferPath) || !fs.statSync(bufferPath).isFile()) {
        throw new Error(`glTF-Puffer fehlt für ${asset.folder}: ${uri}.`);
      }
      const actualSize = fs.statSync(bufferPath).size;
      if (actualSize === 0) throw new Error(`glTF-Puffer ist leer für ${asset.folder}: ${uri}.`);
      if (Number.isFinite(Number(buffer.byteLength)) && actualSize < Number(buffer.byteLength)) {
        throw new Error(`glTF-Puffer ist zu kurz für ${asset.folder}: ${uri}.`);
      }
    }
    if (document?.extensionsUsed?.includes('ASOBO_asset_optimized')) optimized = true;
  }
  const xmlText = fs.readdirSync(modelRoot)
    .filter((name) => name.toLowerCase().endsWith('.xml'))
    .map((name) => fs.readFileSync(path.join(modelRoot, name), 'utf8'))
    .join('\n');
  for (const control of controlsFromAsset(asset)) {
    if (!xmlText.includes(control.simvar)) throw new Error(`Control ${control.id}: deklarierte LVar fehlt im Modell-XML: ${control.simvar}.`);
  }
  if (asset.collisionProfile && options.modelLibRoot) {
    const collisionRoot = path.join(options.modelLibRoot, asset.collisionProfile.sourceFolder);
    const collisionXml = path.join(collisionRoot, 'HomebaseRoundHangarCollision.xml');
    if (!fs.existsSync(collisionRoot) || !fs.statSync(collisionRoot).isDirectory()) throw new Error(`Collision-ModelLib fehlt für ${asset.folder}: ${collisionRoot}.`);
    const xmlFiles = fs.readdirSync(collisionRoot).filter((name) => name.toLowerCase().endsWith('.xml'));
    const gltfCollisionFiles = fs.readdirSync(collisionRoot).filter((name) => name.toLowerCase().endsWith('.gltf'));
    if (!xmlFiles.length || !gltfCollisionFiles.length) throw new Error(`Collision-ModelLib ist unvollständig für ${asset.folder}.`);
    const collisionXmlText = fs.readFileSync(fs.existsSync(collisionXml) ? collisionXml : path.join(collisionRoot, xmlFiles[0]), 'utf8');
    if (!collisionXmlText.toUpperCase().includes(asset.collisionProfile.modelLibGuid)) throw new Error(`Collision-GUID fehlt im ModelLib-XML für ${asset.folder}.`);
  }
  if (options.requireCompiled && !optimized) throw new Error(`Kompiliertes ASOBO-Modell fehlt fÃ¼r ${asset.folder}.`);
  if (options.requireRaw && optimized) throw new Error(`${asset.folder} enthÃ¤lt bereits ein kompiliertes Modell. Bitte die rohe SDK-Quelle importieren.`);
  return { title, gltfFiles, optimized };
}

function validateModelLibSource(modelLibRoot, asset) {
  if (!asset.collisionProfile) return null;
  const folder = path.join(modelLibRoot, asset.collisionProfile.sourceFolder);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error(`ModelLib-Quellordner fehlt: ${folder}.`);
  const xmlFiles = fs.readdirSync(folder).filter((name) => name.toLowerCase().endsWith('.xml'));
  const gltfFiles = fs.readdirSync(folder).filter((name) => name.toLowerCase().endsWith('.gltf'));
  if (xmlFiles.length !== 1 || gltfFiles.length !== 1) throw new Error(`ModelLib ${asset.collisionProfile.sourceFolder} benötigt exakt ein XML und ein glTF.`);
  const xmlText = fs.readFileSync(path.join(folder, xmlFiles[0]), 'utf8');
  if (!xmlText.toUpperCase().includes(asset.collisionProfile.modelLibGuid)) throw new Error(`ModelLib-GUID stimmt nicht für ${asset.key}.`);
  const gltfPath = path.join(folder, gltfFiles[0]);
  const gltfText = fs.readFileSync(gltfPath, 'utf8');
  const document = JSON.parse(gltfText);
  if (gltfText.includes('ASOBO_asset_optimized')) throw new Error(`ModelLib ${asset.collisionProfile.sourceFolder} ist keine rohe Quelle.`);
  if (!document.extensionsUsed?.includes('ASOBO_tags')) throw new Error(`ModelLib ${asset.collisionProfile.sourceFolder} enthält keine Collision-Tags.`);
  const hasGround = (document.materials || []).some((material) => material.extensions?.ASOBO_tags?.tags?.includes('Ground'));
  const hasCollision = (document.materials || []).some((material) => material.extensions?.ASOBO_tags?.tags?.includes('Collision'));
  const groundSurface = String(asset.collisionProfile.groundSurface || '').toLowerCase();
  const requiresGround = !['none', 'wall-only', 'walls-and-columns-only'].includes(groundSurface);
  if (!hasCollision || (requiresGround && !hasGround)) {
    throw new Error(`ModelLib ${asset.collisionProfile.sourceFolder} braucht Collision-Tags${requiresGround ? ' sowie Ground-Tags' : ''}.`);
  }
  for (const buffer of document.buffers || []) {
    const bufferPath = path.join(folder, String(buffer.uri || ''));
    if (!buffer.uri || !fs.existsSync(bufferPath) || fs.statSync(bufferPath).size === 0) throw new Error(`ModelLib-BIN fehlt oder ist leer: ${buffer.uri || '(leer)'}.`);
  }
  return { folder, xmlFiles, gltfFiles };
}

function sdkErrorSummary(projectRoot) {
  const reportPath = path.join(projectRoot, '_PackageInt', '_RPTErrors.xml');
  if (!fs.existsSync(reportPath)) return '';
  const report = fs.readFileSync(reportPath, 'utf8');
  const files = [...report.matchAll(/<File\s+Path="([^"]+)"\s*\/>/gi)].map((match) => path.basename(match[1]));
  const messages = [...report.matchAll(/<Location\s+Message="([^"]+)"/gi)].map((match) => match[1]);
  const uniqueFiles = [...new Set(files)].slice(0, 8);
  const uniqueMessages = [...new Set(messages)].slice(0, 3);
  return [
    uniqueFiles.length ? `SDK konnte diese Modelle nicht verarbeiten: ${uniqueFiles.join(', ')}` : '',
    uniqueMessages.length ? uniqueMessages.join(' | ') : '',
    `SDK-Fehlerbericht: ${reportPath}`
  ].filter(Boolean).join('\n');
}

function validateCompiledPackage(packageRoot, catalog) {
  assertProductionCatalog(catalog);
  const manifestPath = path.join(packageRoot, 'manifest.json');
  const layoutPath = path.join(packageRoot, 'layout.json');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(layoutPath)) throw new Error(`Fertiges Paket fehlt: ${packageRoot}`);
  const manifest = jsonRead(manifestPath);
  const layout = jsonRead(layoutPath);
  if (!manifest || !layout || !Array.isArray(layout.content)) throw new Error('manifest.json oder layout.json ist ungÃ¼ltig.');
  if (String(manifest.package_version || '') !== String(catalog.package.version)) {
    throw new Error(`Build-Version ${manifest.package_version || '(fehlt)'} passt nicht zur Katalogversion ${catalog.package.version}.`);
  }
  const actualByLower = new Map(walkFiles(packageRoot).map((relative) => [relative.toLowerCase(), relative]));
  for (const entry of layout.content) {
    const actual = actualByLower.get(String(entry.path || '').toLowerCase());
    if (!actual) throw new Error(`Layout-Datei fehlt: ${entry.path}`);
    if (fs.statSync(path.join(packageRoot, ...actual.split('/'))).size !== Number(entry.size)) throw new Error(`Layout-GrÃ¶ÃŸe stimmt nicht: ${entry.path}`);
  }
  for (const asset of catalog.assets) {
    validateSourceAsset(path.join(packageRoot, 'SimObjects', 'Misc', asset.folder), asset, { requireCompiled: true });
  }
  if (catalog.assets.some((asset) => asset.collisionProfile)) {
    const modelLibBgl = (layout.content || []).find((entry) => /scenery\/.+\.bgl$/i.test(String(entry.path || '')));
    if (!modelLibBgl) throw new Error('Kompiliertes ModelLib-Collision-BGL fehlt im Paketlayout.');
  }
  return { manifest, layout, files: fileRecords(packageRoot) };
}

function defaultConfig() {
  return {
    sdkPath: process.env.MSFS_PACKAGE_TOOL || DEFAULT_SDK,
    repoPath: '',
    remote: 'origin',
    branch: 'main',
    port: 8797
  };
}

export function createPublisher(options = {}) {
  const distributionRoot = path.resolve(options.distributionRoot || process.cwd());
  const seedRoot = path.resolve(options.seedRoot || path.join(distributionRoot, 'seed'));
  const dataRoot = path.resolve(options.dataRoot || path.join(distributionRoot, 'Homebase-Asset-Publisher-Data'));
  const catalogPath = path.join(dataRoot, 'catalog.json');
  const configPath = path.join(dataRoot, 'publisher-config.json');
  const sourceRoot = path.join(dataRoot, 'source', 'SimObjects', 'Misc');
  const sourceHistoryRoot = path.join(dataRoot, 'source-history');
  const modelLibRoot = path.join(dataRoot, 'source', 'ModelLib');
  const projectRoot = path.join(dataRoot, 'sdk-project');
  const releasesRoot = path.join(dataRoot, 'releases');
  const buildLogPath = path.join(dataRoot, 'last-build.log');

  const initialize = () => {
    fs.mkdirSync(dataRoot, { recursive: true });
    if (!fs.existsSync(catalogPath)) {
      const seedCatalog = path.join(seedRoot, 'catalog.json');
      const seedSources = path.join(seedRoot, 'PackageSources', 'SimObjects', 'Misc');
      if (!fs.existsSync(seedCatalog) || !fs.existsSync(seedSources)) throw new Error(`Publisher-Seed fehlt unter ${seedRoot}.`);
      copyTree(seedCatalog, catalogPath);
      copyTree(seedSources, sourceRoot);
    }
    if (!fs.existsSync(configPath)) jsonWrite(configPath, defaultConfig());
  };

  initialize();

  const getConfig = () => ({ ...defaultConfig(), ...(jsonRead(configPath, {}) || {}) });
  const getCatalog = () => {
    const catalog = visibilityPolicy.normalizeAssetCatalog(jsonRead(catalogPath));
    if (!catalog?.package?.name || !VERSION.test(String(catalog.package.version || '')) || !Array.isArray(catalog.assets)) {
      throw new Error(`Publisher-Katalog ist ungÃ¼ltig: ${catalogPath}`);
    }
    return catalog;
  };

  const createSourceHistorySnapshot = (sourcePath, asset, catalog) => {
    const version = safeVersion(asset.version);
    const assetHistoryRoot = path.join(sourceHistoryRoot, asset.folder);
    const snapshotRoot = path.join(assetHistoryRoot, version);
    const sourceFiles = fileRecords(sourcePath);
    const sourceContentHash = contentHash(sourceFiles);
    if (fs.existsSync(snapshotRoot)) {
      const existingSnapshot = jsonRead(path.join(snapshotRoot, 'snapshot.json'));
      if (existingSnapshot?.sourceContentHash === sourceContentHash
          && existingSnapshot?.asset?.key === asset.key
          && existingSnapshot?.asset?.version === version) {
        return { path: snapshotRoot, version, sourceContentHash, reused: true };
      }
      throw new Error(`UnverÃ¤nderliche Quellensicherung existiert bereits mit abweichendem Inhalt: ${snapshotRoot}`);
    }
    const stagingRoot = path.join(dataRoot, '.history-staging', asset.folder, version);
    fs.rmSync(path.join(dataRoot, '.history-staging'), { recursive: true, force: true });
    try {
      copyTree(sourcePath, path.join(stagingRoot, 'source'));
      const copiedFiles = fileRecords(path.join(stagingRoot, 'source'));
      if (contentHash(copiedFiles) !== sourceContentHash) throw new Error(`HashprÃ¼fung der Quellensicherung fehlgeschlagen: ${asset.folder} ${version}`);
      jsonWrite(path.join(stagingRoot, 'catalog-entry.json'), asset);
      jsonWrite(path.join(stagingRoot, 'package-info.json'), {
        packageName: catalog.package.name,
        packageVersion: catalog.package.version,
        assetKey: asset.key,
        assetFolder: asset.folder,
        assetVersion: version
      });
      jsonWrite(path.join(stagingRoot, 'snapshot.json'), {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        sourceContentHash,
        sourceFiles: copiedFiles,
        asset,
        package: catalog.package
      });
      fs.mkdirSync(assetHistoryRoot, { recursive: true });
      fs.renameSync(stagingRoot, snapshotRoot);
      fs.rmSync(path.join(dataRoot, '.history-staging'), { recursive: true, force: true });
      return { path: snapshotRoot, version, sourceContentHash, reused: false };
    } catch (error) {
      fs.rmSync(path.join(dataRoot, '.history-staging'), { recursive: true, force: true });
      throw error;
    }
  };

  const saveConfig = (input = {}) => {
    const current = getConfig();
    const next = {
      ...current,
      sdkPath: path.resolve(String(input.sdkPath || current.sdkPath)),
      repoPath: input.repoPath ? path.resolve(String(input.repoPath)) : '',
      remote: String(input.remote || current.remote || 'origin').replace(/[^A-Za-z0-9._-]/g, ''),
      branch: String(input.branch || current.branch || 'main').replace(/[^A-Za-z0-9._/-]/g, '')
    };
    if (!next.remote || !next.branch) throw new Error('Remote und Branch dÃ¼rfen nicht leer sein.');
    jsonWrite(configPath, next);
    return next;
  };

  const setPackageVersion = (version) => {
    const catalog = getCatalog();
    catalog.package.version = safeVersion(version);
    catalog.updatedAt = new Date().toISOString();
    jsonWrite(catalogPath, catalog);
    return catalog;
  };

  const inspectSourceAssets = (input = {}) => {
    const requestedRoot = String(input.sourcePath || '').trim();
    if (!requestedRoot) throw new Error('Bitte einen Quellenordner angeben.');
    const incomingRoot = path.resolve(requestedRoot);
    if (!fs.existsSync(incomingRoot) || !fs.statSync(incomingRoot).isDirectory()) throw new Error(`Quellenordner nicht gefunden: ${incomingRoot}`);
    const catalog = getCatalog();
    const directAsset = fs.existsSync(path.join(incomingRoot, 'sim.cfg'));
    const folders = directAsset ? [incomingRoot] : fs.readdirSync(incomingRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => path.join(incomingRoot, entry.name));
    const assets = folders.map((folder) => inspectSourceFolder(folder, catalog));
    return { sourcePath: incomingRoot, assets, validCount: assets.filter((asset) => asset.valid).length };
  };

  const importAsset = (input = {}) => {
    if (input.confirmed !== true) throw Object.assign(new Error('Der Import benÃ¶tigt eine ausdrÃ¼ckliche BestÃ¤tigung.'), { code: 'CONFIRMATION_REQUIRED' });
    const catalog = getCatalog();
    const requestedKey = String(input.key || '').trim();
    const existingIndex = catalog.assets.findIndex((entry) => entry.key.toLowerCase() === requestedKey.toLowerCase()
      || entry.folder.toLowerCase() === String(input.folder || '').trim().toLowerCase()
      || entry.title.toLowerCase() === String(input.title || '').trim().toLowerCase());
    const existing = existingIndex >= 0 ? catalog.assets[existingIndex] : {};
    const asset = safeAsset(input, existing);
    const duplicate = catalog.assets.find((entry, index) => index !== existingIndex
      && (entry.folder.toLowerCase() === asset.folder.toLowerCase() || entry.title.toLowerCase() === asset.title.toLowerCase()));
    if (duplicate) throw new Error(`Ordner oder SimObject-Titel wird bereits von ${duplicate.key} verwendet.`);
    if (input.metadataOnly === true) {
      if (existingIndex < 0) throw new Error('Eine reine Metadatenänderung ist nur für ein vorhandenes Katalog-Asset möglich.');
      const target = path.join(sourceRoot, existing.folder);
      validateSourceAsset(target, asset, { requireRaw: true, modelLibRoot: path.join(dataRoot, 'source', 'ModelLib') });
      catalog.assets[existingIndex] = asset;
      catalog.assets.sort((a, b) => a.key.localeCompare(b.key));
      catalog.updatedAt = new Date().toISOString();
      jsonWrite(catalogPath, catalog);
      return { asset, sourcePath: target, assetCount: catalog.assets.length, metadataOnly: true };
    }
    if (existingIndex >= 0 && !versionIsGreater(asset.version, existing.version)) {
      throw new Error(`Neue Assetversion ${asset.version} muss grÃ¶ÃŸer als die vorhandene Version ${existing.version} sein. Vorschlag: ${nextPatchVersion(existing.version)}.`);
    }
    const incoming = path.resolve(String(input.sourcePath || ''));
    if (!fs.existsSync(incoming) || !fs.statSync(incoming).isDirectory()) throw new Error(`Quellordner nicht gefunden: ${incoming}`);
    validateSourceAsset(incoming, asset, { requireRaw: true, modelLibRoot: path.join(dataRoot, 'source', 'ModelLib') });
    const staging = path.join(dataRoot, '.import-staging', asset.folder);
    fs.rmSync(path.dirname(staging), { recursive: true, force: true });
    copyTree(incoming, staging);
    jsonWrite(path.join(staging, SIDECAR_NAME), asset);
    validateSourceAsset(staging, asset, { requireRaw: true, modelLibRoot: path.join(dataRoot, 'source', 'ModelLib') });
    const history = existingIndex >= 0
      ? createSourceHistorySnapshot(path.join(sourceRoot, existing.folder), existing, catalog)
      : null;
    if (existing.folder && existing.folder !== asset.folder) fs.rmSync(path.join(sourceRoot, existing.folder), { recursive: true, force: true });
    const target = path.join(sourceRoot, asset.folder);
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);
    fs.rmSync(path.join(dataRoot, '.import-staging'), { recursive: true, force: true });
    if (existingIndex >= 0) catalog.assets[existingIndex] = asset;
    else catalog.assets.push(asset);
    catalog.assets.sort((a, b) => a.key.localeCompare(b.key));
    catalog.updatedAt = new Date().toISOString();
    jsonWrite(catalogPath, catalog);
    return { asset, sourcePath: target, assetCount: catalog.assets.length, history };
  };

  const prepareProject = () => {
    const catalog = getCatalog();
    assertProductionCatalog(catalog);
    const expected = new Set(catalog.assets.map((asset) => asset.folder));
    const sourceFolders = fs.readdirSync(sourceRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    for (const asset of catalog.assets) {
      validateSourceAsset(path.join(sourceRoot, asset.folder), asset, { requireRaw: true, modelLibRoot });
      validateModelLibSource(modelLibRoot, asset);
    }
    const extra = sourceFolders.filter((folder) => !expected.has(folder));
    if (extra.length) throw new Error(`Nicht katalogisierte Quellordner gefunden: ${extra.join(', ')}`);
    fs.rmSync(projectRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(projectRoot, 'PackageDefinitions'), { recursive: true });
    copyTree(path.join(dataRoot, 'source'), path.join(projectRoot, 'PackageSources'));
    for (const relative of walkFiles(path.join(projectRoot, 'PackageSources')).filter((name) => path.basename(name).toLowerCase() === SIDECAR_NAME)) {
      fs.rmSync(path.join(projectRoot, 'PackageSources', ...relative.split('/')), { force: true });
    }
    const packageName = catalog.package.name;
    const projectXml = `<?xml version="1.0" encoding="utf-8"?>\n<Project Version="2" Name="VFR-Multitool-Homebase-Assets" FolderName="Packages" MetadataFolderName="PackagesMetadata">\n  <OutputDirectory>.</OutputDirectory>\n  <TemporaryOutputDirectory>_PackageInt</TemporaryOutputDirectory>\n  <Packages><Package>PackageDefinitions\\${packageName}.xml</Package></Packages>\n  <PublishingGroups/>\n</Project>\n`;
    const simObjectGroups = catalog.assets.map((asset) => `    <AssetGroup Name="${asset.folder}">\n      <Type>SimObject</Type>\n      <Flags><FSXCompatibility>false</FSXCompatibility></Flags>\n      <AssetDir>PackageSources\\SimObjects\\Misc\\${asset.folder}</AssetDir>\n      <OutputDir>SimObjects\\Misc\\${asset.folder}</OutputDir>\n    </AssetGroup>`);
    const collisionFolders = [...new Set(catalog.assets.map((asset) => asset.collisionProfile?.sourceFolder).filter(Boolean))];
    const modelLibGroups = collisionFolders.map((folder) => `    <AssetGroup Name="${folder}">\n      <Type>ArtProj</Type>\n      <Flags><FSXCompatibility>false</FSXCompatibility></Flags>\n      <AssetDir>PackageSources\\ModelLib\\${folder}</AssetDir>\n      <OutputDir>Scenery\\${packageName}\\ModelLib</OutputDir>\n    </AssetGroup>`);
    const groups = [...simObjectGroups, ...modelLibGroups].join('\n');
    const packageXml = `<?xml version="1.0" encoding="utf-8"?>\n<AssetPackage Version="${catalog.package.version}">\n  <PackageOrderHint>CUSTOM_SIMOBJECTS</PackageOrderHint>\n  <ItemSettings>\n    <ContentType>MISC</ContentType>\n    <Title>VFR Multitool Homebase Assets</Title>\n    <Creator>VFR Multitool</Creator>\n    <Description>Versioned VFR Multitool Homebase and mission SimObjects.</Description>\n  </ItemSettings>\n  <Flags><VisibleInStore>false</VisibleInStore><CanBeReferenced>false</CanBeReferenced></Flags>\n  <AssetGroups>\n${groups}\n  </AssetGroups>\n</AssetPackage>\n`;
    fs.writeFileSync(path.join(projectRoot, 'HomebaseAssetsProject.xml'), projectXml, 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'PackageDefinitions', `${packageName}.xml`), packageXml, 'utf8');
    return { projectRoot, projectFile: path.join(projectRoot, 'HomebaseAssetsProject.xml'), packageName, version: catalog.package.version, assetCount: catalog.assets.length };
  };

  const buildPackage = () => {
    const config = getConfig();
    if (isSimulatorRunning()) throw Object.assign(new Error('MSFS lÃ¤uft noch. Vor dem offiziellen Assetbuild bitte schlieÃŸen.'), { code: 'SIM_RUNNING' });
    if (!fs.existsSync(config.sdkPath)) throw Object.assign(new Error(`MSFS Package Tool nicht gefunden: ${config.sdkPath}`), { code: 'SDK_MISSING' });
    const prepared = prepareProject();
    // The MSFS compiler still fails on deeply nested Windows paths. Build from a
    // deterministic short staging path, then copy the validated result back into
    // the Publisher data directory so all later release steps remain local.
    const buildWorkspace = path.join(os.tmpdir(), 'vfr-homebase-sdk', prepared.version);
    fs.rmSync(buildWorkspace, { recursive: true, force: true });
    copyTree(projectRoot, buildWorkspace);
    const buildProjectFile = path.join(buildWorkspace, path.basename(prepared.projectFile));
    const args = [buildProjectFile, '-outputdir', buildWorkspace, '-tempdir', buildWorkspace, '-rebuild', '-forcesteam', '-nopause'];
    const result = spawnSync(config.sdkPath, args, {
      cwd: buildWorkspace,
      encoding: 'utf8',
      windowsHide: false,
      timeout: 15 * 60 * 1000,
      maxBuffer: 40 * 1024 * 1024
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    fs.writeFileSync(buildLogPath, `Tool: ${config.sdkPath}\nWorkspace: ${buildWorkspace}\nArgs: ${args.join(' ')}\nExit: ${result.status}\n\n${output}`, 'utf8');
    if (result.error) throw result.error;
    if ((result.status ?? 1) !== 0) throw new Error(`Package Tool endete mit Code ${result.status}. Siehe ${buildLogPath}`);
    const builtPackageRoot = path.join(buildWorkspace, 'Packages', prepared.packageName);
    if (!fs.existsSync(path.join(builtPackageRoot, 'manifest.json')) || !fs.existsSync(path.join(builtPackageRoot, 'layout.json'))) {
      const sdkDetails = sdkErrorSummary(buildWorkspace);
      throw new Error(`Das MSFS SDK hat kein fertiges Paket erzeugt.${sdkDetails ? `\n${sdkDetails}` : ''}\nBuild-Log: ${buildLogPath}`);
    }
    validateCompiledPackage(builtPackageRoot, getCatalog());
    for (const folder of ['Packages', 'PackagesMetadata', '_PackageInt']) {
      const source = path.join(buildWorkspace, folder);
      const target = path.join(projectRoot, folder);
      if (!fs.existsSync(source)) continue;
      fs.rmSync(target, { recursive: true, force: true });
      copyTree(source, target);
    }
    const packageRoot = path.join(projectRoot, 'Packages', prepared.packageName);
    const validated = validateCompiledPackage(packageRoot, getCatalog());
    return { ...prepared, packageRoot, buildWorkspace, buildLogPath, fileCount: validated.files.length };
  };

  const latestPreviousIndex = (excludingVersion) => {
    if (!fs.existsSync(releasesRoot)) return null;
    const candidates = fs.readdirSync(releasesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== excludingVersion)
      .map((entry) => path.join(releasesRoot, entry.name, 'package-index.json'))
      .filter((file) => fs.existsSync(file))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return candidates.length ? jsonRead(candidates[0]) : null;
  };

  const prepareRelease = (input = {}) => {
    const catalog = getCatalog();
    assertProductionCatalog(catalog);
    const version = safeVersion(input.version || catalog.package.version);
    if (version !== catalog.package.version) throw new Error(`Release ${version} passt nicht zur gebauten Katalogversion ${catalog.package.version}.`);
    const packageRoot = path.join(projectRoot, 'Packages', catalog.package.name);
    const validated = validateCompiledPackage(packageRoot, catalog);
    const releaseRoot = path.join(releasesRoot, version);
    fs.rmSync(releaseRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(releaseRoot, 'assets'), { recursive: true });
    const config = getConfig();
    let repoSlug = '';
    if (config.repoPath && fs.existsSync(path.join(config.repoPath, '.git'))) {
      const remote = run('git', ['remote', 'get-url', config.remote], config.repoPath, { allowFailure: true });
      repoSlug = remote.ok ? parseRepoSlug(remote.output) : '';
    }
    const tag = `homebase-assets-v${version}`;
    const baseUrl = repoSlug ? `https://github.com/${repoSlug}/releases/download/${tag}` : '';
    const previous = latestPreviousIndex(version);
    const previousByKey = new Map((previous?.assets || []).map((asset) => [asset.key, asset]));
    const assets = [];
    for (const asset of catalog.assets) {
      const objectRoot = path.join(packageRoot, 'SimObjects', 'Misc', asset.folder);
      const relativeRoot = `SimObjects/Misc/${asset.folder}`;
      const files = fileRecords(objectRoot).map((file) => ({ ...file, path: `${relativeRoot}/${file.path}` }));
      const entries = entriesFromDirectory(objectRoot, relativeRoot);
      if (asset.collisionProfile) {
        const sceneryRoot = path.join(packageRoot, 'Scenery');
        const collisionFiles = fileRecords(sceneryRoot)
          .filter((file) => file.path.toLowerCase().endsWith('.bgl'))
          .map((file) => ({ ...file, path: `Scenery/${file.path}` }));
        files.push(...collisionFiles);
        for (const file of collisionFiles) {
          entries.push({ name: file.path, data: fs.readFileSync(path.join(packageRoot, ...file.path.split('/'))) });
        }
      }
      const modelHash = contentHash(files);
      const metadataHash = assetMetadataHash(asset);
      const hash = sha256Text(`${modelHash}:${metadataHash}`);
      const archiveName = `${asset.key}-${asset.version}.zip`;
      const fragment = {
        schemaVersion: 1,
        packageName: catalog.package.name,
        packageVersion: version,
        asset: { ...asset, modelHash, metadataHash, contentHash: hash },
        files
      };
      entries.push({ name: 'asset-fragment.json', data: Buffer.from(`${JSON.stringify(fragment, null, 2)}\n`) });
      const archivePath = path.join(releaseRoot, 'assets', archiveName);
      createZip(entries, archivePath);
      const archive = {
        name: archiveName,
        path: `assets/${archiveName}`,
        url: baseUrl ? `${baseUrl}/${archiveName}` : '',
        size: fs.statSync(archivePath).size,
        sha256: sha256File(archivePath)
      };
      assets.push({ ...asset, modelHash, metadataHash, contentHash: hash, changed: previousByKey.get(asset.key)?.contentHash !== hash, files, archive });
    }
    const currentKeys = new Set(assets.map((asset) => asset.key));
    const removedAssets = [...previousByKey.keys()].filter((key) => !currentKeys.has(key));
    const fullArchiveName = `${catalog.package.name}-${version}-full.zip`;
    const fullArchivePath = path.join(releaseRoot, fullArchiveName);
    createZip(entriesFromDirectory(packageRoot, catalog.package.name), fullArchivePath);
    const packageFiles = validated.files;
    const packageContentHash = contentHash(packageFiles);
    const metadataHash = sha256Text(JSON.stringify(stableValue(catalog.assets.map(assetMetadata))));
    const index = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      packageName: catalog.package.name,
      packageVersion: version,
      releaseTag: tag,
      repository: repoSlug,
      contentHash: sha256Text(`${packageContentHash}:${metadataHash}`),
      packageContentHash,
      metadataHash,
      files: packageFiles,
      assets,
      changedAssets: assets.filter((asset) => asset.changed).map((asset) => asset.key),
      removedAssets,
      fullArchive: {
        name: fullArchiveName,
        url: baseUrl ? `${baseUrl}/${fullArchiveName}` : '',
        size: fs.statSync(fullArchivePath).size,
        sha256: sha256File(fullArchivePath)
      }
    };
    jsonWrite(path.join(releaseRoot, 'package-index.json'), index);
    const preview = {
      schemaVersion: 1,
      packageName: index.packageName,
      packageVersion: index.packageVersion,
      releaseTag: tag,
      indexUrl: baseUrl ? `${baseUrl}/package-index.json` : '',
      contentHash: index.contentHash,
      fullArchive: index.fullArchive,
      changedAssets: index.changedAssets,
      removedAssets: index.removedAssets
    };
    jsonWrite(path.join(releaseRoot, 'stable-preview.json'), preview);
    return { releaseRoot, indexPath: path.join(releaseRoot, 'package-index.json'), fullArchivePath, index };
  };

  const repositoryDiagnostics = () => {
    const config = getConfig();
    const repoValid = Boolean(config.repoPath && fs.existsSync(path.join(config.repoPath, '.git')));
    const result = { repoValid, repoPath: config.repoPath, sdkInstalled: fs.existsSync(config.sdkPath), sdkPath: config.sdkPath, ghAvailable: false, ghAuthenticated: false, branch: '', remoteUrl: '', repoSlug: '', changes: [], unrelatedChanges: [] };
    const gh = run('gh', ['--version'], config.repoPath || distributionRoot, { allowFailure: true });
    result.ghAvailable = gh.ok;
    if (gh.ok) result.ghAuthenticated = run('gh', ['auth', 'status'], config.repoPath || distributionRoot, { allowFailure: true }).ok;
    if (!repoValid) return result;
    result.branch = run('git', ['branch', '--show-current'], config.repoPath).output.trim();
    const remote = run('git', ['remote', 'get-url', config.remote], config.repoPath, { allowFailure: true });
    result.remoteUrl = remote.output.trim();
    result.repoSlug = parseRepoSlug(result.remoteUrl);
    const status = run('git', ['status', '--porcelain'], config.repoPath).output;
    result.changes = status ? status.split(/\r?\n/).filter(Boolean) : [];
    result.unrelatedChanges = result.changes.filter((line) => {
      const file = line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop().replaceAll('\\', '/');
      return !file.startsWith('homebase/assets/');
    });
    return result;
  };

  const publishRelease = (input = {}) => {
    if (input.confirmed !== true) throw Object.assign(new Error('VerÃ¶ffentlichung benÃ¶tigt eine ausdrÃ¼ckliche BestÃ¤tigung.'), { code: 'CONFIRMATION_REQUIRED' });
    const config = getConfig();
    const version = safeVersion(input.version || getCatalog().package.version);
    const prepared = prepareRelease({ version });
    let diagnostics = repositoryDiagnostics();
    if (!diagnostics.repoValid) throw new Error('Kein gÃ¼ltiges Git-Repository konfiguriert.');
    if (!diagnostics.ghAvailable || !diagnostics.ghAuthenticated) throw new Error('GitHub CLI fehlt oder ist nicht angemeldet. Auf dem PC zuerst â€žgh auth login -h github.comâ€œ ausfÃ¼hren.');
    if (!diagnostics.repoSlug) throw new Error('Origin verweist nicht auf ein erkennbares GitHub-Repository.');
    if (diagnostics.branch !== config.branch) throw new Error(`Aktiver Branch ist ${diagnostics.branch || '(keiner)'}, erwartet wird ${config.branch}.`);
    if (diagnostics.unrelatedChanges.length) throw new Error(`UnabhÃ¤ngige Worktree-Ã„nderungen blockieren den Publish:\n${diagnostics.unrelatedChanges.join('\n')}`);
    run('gh', ['auth', 'setup-git'], config.repoPath);
    run('git', ['pull', '--ff-only', config.remote, config.branch], config.repoPath, { timeoutMs: 180000 });
    diagnostics = repositoryDiagnostics();
    if (diagnostics.unrelatedChanges.length) throw new Error('Nach dem Aktualisieren sind unabhÃ¤ngige Ã„nderungen vorhanden.');
    const releaseRoot = prepared.releaseRoot;
    const index = prepared.index;
    const repoAssetsRoot = path.join(config.repoPath, 'homebase', 'assets');
    const repoReleaseRoot = path.join(repoAssetsRoot, 'releases', version);
    fs.mkdirSync(repoAssetsRoot, { recursive: true });
    fs.rmSync(path.join(repoAssetsRoot, 'source'), { recursive: true, force: true });
    copyTree(path.join(dataRoot, 'source'), path.join(repoAssetsRoot, 'source'));
    copyTree(catalogPath, path.join(repoAssetsRoot, 'catalog.json'));
    fs.mkdirSync(repoReleaseRoot, { recursive: true });
    copyTree(path.join(releaseRoot, 'package-index.json'), path.join(repoReleaseRoot, 'package-index.json'));
    run('git', ['add', '--', 'homebase/assets/catalog.json', 'homebase/assets/source', `homebase/assets/releases/${version}/package-index.json`], config.repoPath);
    const staged = run('git', ['diff', '--cached', '--quiet'], config.repoPath, { allowFailure: true });
    if (!staged.ok) {
      run('git', ['commit', '-m', `Homebase asset sources ${version}`], config.repoPath);
      run('git', ['push', config.remote, `HEAD:${config.branch}`], config.repoPath, { timeoutMs: 180000 });
    }
    const tag = index.releaseTag;
    if (run('gh', ['release', 'view', tag, '--repo', diagnostics.repoSlug], config.repoPath, { allowFailure: true }).ok) {
      throw new Error(`GitHub-Release ${tag} existiert bereits. Eine bestehende VerÃ¶ffentlichung wird nicht Ã¼berschrieben.`);
    }
    const releaseFiles = [
      path.join(releaseRoot, 'package-index.json'),
      prepared.fullArchivePath,
      ...index.assets.map((asset) => path.join(releaseRoot, asset.archive.path))
    ];
    run('gh', [
      'release', 'create', tag,
      '--repo', diagnostics.repoSlug,
      '--target', config.branch,
      '--title', `VFR Multitool Homebase Assets ${version}`,
      '--notes', `Versioniertes Homebase-Assetpaket ${version}. GeÃ¤nderte Assets: ${index.changedAssets.join(', ') || 'keine'}.`,
      ...releaseFiles
    ], config.repoPath, { timeoutMs: 10 * 60 * 1000 });
    const baseUrl = `https://github.com/${diagnostics.repoSlug}/releases/download/${tag}`;
    const stable = {
      schemaVersion: 1,
      publishedAt: new Date().toISOString(),
      packageName: index.packageName,
      packageVersion: index.packageVersion,
      releaseTag: tag,
      indexUrl: `${baseUrl}/package-index.json`,
      contentHash: index.contentHash,
      fullArchive: { ...index.fullArchive, url: `${baseUrl}/${index.fullArchive.name}` },
      changedAssets: index.changedAssets,
      removedAssets: index.removedAssets
    };
    jsonWrite(path.join(repoAssetsRoot, 'channel', 'stable.json'), stable);
    run('git', ['add', '--', 'homebase/assets/channel/stable.json'], config.repoPath);
    run('git', ['commit', '-m', `Publish Homebase assets ${version}`], config.repoPath);
    run('git', ['push', config.remote, `HEAD:${config.branch}`], config.repoPath, { timeoutMs: 180000 });
    return { version, tag, repoSlug: diagnostics.repoSlug, releaseUrl: `https://github.com/${diagnostics.repoSlug}/releases/tag/${tag}`, stable };
  };

  const status = () => {
    const catalog = getCatalog();
    const config = getConfig();
    const packageRoot = path.join(projectRoot, 'Packages', catalog.package.name);
    let build = { available: false, packageRoot };
    try {
      const validated = validateCompiledPackage(packageRoot, catalog);
      build = { available: true, packageRoot, fileCount: validated.files.length, version: validated.manifest.package_version };
    } catch (error) {
      build.error = error?.message || String(error);
    }
    return {
      app: 'VFR Multitool Homebase Asset Publisher',
      version: '0.4.0',
      dataRoot,
      catalogPath,
      sourceRoot,
      sourceHistoryRoot,
      suggestedSourcePath: path.resolve(distributionRoot, '..', 'Quellen'),
      projectRoot,
      releasesRoot,
      config,
      package: catalog.package,
      assetCount: catalog.assets.length,
      assets: catalog.assets,
      simulatorRunning: isSimulatorRunning(),
      build,
      repository: repositoryDiagnostics()
    };
  };

  return {
    initialize,
    status,
    getConfig,
    saveConfig,
    getCatalog,
    setPackageVersion,
    inspectSourceAssets,
    importAsset,
    prepareProject,
    buildPackage,
    prepareRelease,
    repositoryDiagnostics,
    publishRelease,
    paths: { distributionRoot, seedRoot, dataRoot, catalogPath, sourceRoot, sourceHistoryRoot, projectRoot, releasesRoot, buildLogPath }
  };
}
