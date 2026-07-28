const fs = require('node:fs');
const path = require('node:path');

const projectDirectory = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'));
const version = String(packageJson.version || '').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Ungueltige Desktop-Version: ${version || '(leer)'}`);
}

const releaseTag = `tracker-desktop-v${version}`;
const installerName = `VFR-Multitool-Tracker-Setup-${version}.exe`;
const releaseBase = `https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/download/${releaseTag}`;
const installerUrl = `${releaseBase}/${installerName}`;
const sourcePath = path.join(projectDirectory, 'dist', 'latest.yml');
const installerPath = path.join(projectDirectory, 'dist', installerName);
const blockmapPath = `${installerPath}.blockmap`;
const channelPath = path.resolve(projectDirectory, '..', 'channel', 'desktop', 'latest.yml');

for (const requiredPath of [sourcePath, installerPath, blockmapPath]) {
  if (!fs.existsSync(requiredPath)) throw new Error(`Release-Artefakt fehlt: ${requiredPath}`);
}

const source = fs.readFileSync(sourcePath, 'utf8');
if (!new RegExp(`^version:\\s*${version.replaceAll('.', '\\.')}$`, 'm').test(source)) {
  throw new Error('latest.yml passt nicht zur Desktop-Version.');
}
if (!source.includes(`url: ${installerName}`) || !source.includes(`path: ${installerName}`)) {
  throw new Error('latest.yml enthaelt nicht den erwarteten Installer.');
}

const channel = source
  .replace(`url: ${installerName}`, `url: ${installerUrl}`)
  .replace(`path: ${installerName}`, `path: ${installerUrl}`);

const dryRun = process.argv.includes('--dry-run');
if (!dryRun) {
  fs.mkdirSync(path.dirname(channelPath), { recursive: true });
  fs.writeFileSync(channelPath, channel, 'utf8');
}

console.log(dryRun ? 'Desktop-Kanal erfolgreich validiert (Dry-run).' : `Desktop-Kanal vorbereitet: ${channelPath}`);
console.log(`Release-Tag: ${releaseTag}`);
console.log(`Upload: ${installerName}`);
console.log(`Upload: ${installerName}.blockmap`);
if (!dryRun) console.log('Danach Signaturen, Download und Installation pruefen; latest.yml erst zuletzt committen.');
