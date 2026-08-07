'use strict';

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  EFB_PACKAGE_NAME,
  inspectEfbPackage,
  validateEfbChannel
} = require('../../desktop/lib/efb-package-manager');
const { extractZipBuffer } = require('../../homebase-asset-updater');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function createDescriptor(channel, packageVersion, archive) {
  const releaseTag = `efb-app-v${packageVersion}`;
  const archiveName = `${EFB_PACKAGE_NAME}-${packageVersion}.zip`;
  return validateEfbChannel({
    schemaVersion: 1,
    channel,
    available: true,
    packageName: EFB_PACKAGE_NAME,
    packageVersion,
    releaseTag,
    publishedAt: new Date().toISOString(),
    archive: {
      name: archiveName,
      url: `https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/download/${releaseTag}/${archiveName}`,
      size: archive.length,
      sha256: sha256(archive)
    }
  }, channel);
}

function zipPackage(packageRoot, archivePath) {
  fs.rmSync(archivePath, { force: true });
  let result;
  if (process.platform === 'win32') {
    const command = '& { param([string]$Source,[string]$Destination) Compress-Archive -LiteralPath $Source -DestinationPath $Destination -CompressionLevel Optimal }';
    result = spawnSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      command,
      packageRoot,
      archivePath
    ], { encoding: 'utf8' });
  } else {
    result = spawnSync('zip', ['-q', '-r', archivePath, path.basename(packageRoot)], {
      cwd: path.dirname(packageRoot),
      encoding: 'utf8'
    });
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ZIP-Erstellung fehlgeschlagen: ${String(result.stderr || result.stdout || '').trim()}`);
  if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size <= 0) throw new Error('EFB-Releasearchiv wurde nicht erzeugt.');
}

function verifyArchive(archive, expectedVersion) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-efb-release-check-'));
  try {
    const extracted = extractZipBuffer(archive, staging, {
      maxEntries: 2000,
      maxExtractedBytes: 128 * 1024 * 1024
    });
    const names = new Set(extracted.names.map((name) => String(name).toLowerCase()));
    if ([...names].some((name) => name !== EFB_PACKAGE_NAME && !name.startsWith(`${EFB_PACKAGE_NAME}/`))) {
      throw new Error('Das EFB-Releasearchiv enthaelt mehr als den erwarteten Paketordner.');
    }
    const inspection = inspectEfbPackage(path.join(staging, EFB_PACKAGE_NAME), expectedVersion);
    if (!inspection.installedComplete) throw new Error(inspection.error || 'Das EFB-Releasearchiv ist unvollstaendig.');
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function main(argv = process.argv.slice(2)) {
  const channel = String(argv[0] || '').trim().toLowerCase();
  if (!['alpha', 'stable'].includes(channel)) throw new Error('Kanal muss alpha oder stable sein.');
  const projectRoot = path.resolve(__dirname, '..');
  const packageRoot = path.resolve(argv[1] || path.join(projectRoot, 'Packages', EFB_PACKAGE_NAME));
  const outputRoot = path.resolve(argv[2] || path.join(projectRoot, 'release-output'));
  const sourceVersion = String(JSON.parse(fs.readFileSync(path.join(projectRoot, 'PackageSources', 'VfrMultitool', 'package.json'), 'utf8')).version || '');
  const inspection = inspectEfbPackage(packageRoot, sourceVersion);
  if (!inspection.installedComplete) throw new Error(inspection.error || `Kein gueltiger SDK-Build gefunden: ${packageRoot}`);

  fs.mkdirSync(outputRoot, { recursive: true });
  const archiveName = `${EFB_PACKAGE_NAME}-${sourceVersion}.zip`;
  const archivePath = path.join(outputRoot, archiveName);
  zipPackage(packageRoot, archivePath);
  const archive = fs.readFileSync(archivePath);
  verifyArchive(archive, sourceVersion);
  const descriptor = createDescriptor(channel, sourceVersion, archive);
  const descriptorPath = path.join(outputRoot, `${channel}.json`);
  fs.writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8');
  fs.writeFileSync(`${archivePath}.sha256`, `${descriptor.archive.sha256}  ${archiveName}\n`, 'utf8');

  console.log(`EFB-Paket geprueft: ${packageRoot}`);
  console.log(`Release-Archiv: ${archivePath}`);
  console.log(`Kanalvorlage: ${descriptorPath}`);
  console.log(`Release-Tag: ${descriptor.releaseTag}`);
  return { archivePath, descriptorPath, descriptor };
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = { createDescriptor, main, verifyArchive, zipPackage };
