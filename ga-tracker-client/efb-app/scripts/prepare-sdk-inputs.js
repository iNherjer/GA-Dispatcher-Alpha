'use strict';

const fs = require('node:fs');
const path = require('node:path');

const supplied = String(process.argv[2] || '').trim();
if (!supplied) {
  console.error('Aufruf: node scripts/prepare-sdk-inputs.js <Pfad-zum-offiziellen-EFB-Sample>');
  process.exit(2);
}

const root = path.resolve(supplied);
const packageSources = fs.existsSync(path.join(root, 'PackageSources')) ? path.join(root, 'PackageSources') : root;
const efbApiSource = path.join(packageSources, 'efb_api');
const templateAppSource = path.join(packageSources, 'TemplateApp');
if (!fs.existsSync(path.join(efbApiSource, 'dist', 'package.json'))) {
  throw new Error(`Offizielles efb_api/dist nicht gefunden. Zuerst im SDK-Ordner ${efbApiSource} npm install ausfuehren.`);
}
const templatePackagePath = path.join(templateAppSource, 'package.json');
if (!fs.existsSync(templatePackagePath)) throw new Error(`Offizielle TemplateApp/package.json nicht gefunden: ${templatePackagePath}`);
const templatePackage = JSON.parse(fs.readFileSync(templatePackagePath, 'utf8'));
const templateDependencies = { ...templatePackage.devDependencies, ...templatePackage.dependencies };
const sourceSdkSpec = String(templateDependencies['@microsoft/msfs-sdk'] || '').trim();
if (!sourceSdkSpec) throw new Error('Die offizielle TemplateApp nennt keine @microsoft/msfs-sdk-Abhaengigkeit.');

const targetSources = path.resolve(__dirname, '..', 'PackageSources');
const efbApiTarget = path.join(targetSources, 'efb_api');
const vendorTarget = path.join(targetSources, 'vendor');
fs.rmSync(efbApiTarget, { recursive: true, force: true });
fs.rmSync(vendorTarget, { recursive: true, force: true });
fs.mkdirSync(vendorTarget, { recursive: true });
fs.cpSync(efbApiSource, efbApiTarget, { recursive: true });

let targetSdkSpec = sourceSdkSpec;
if (sourceSdkSpec.startsWith('file:')) {
  const sourceSdkPath = path.resolve(templateAppSource, sourceSdkSpec.slice(5));
  if (!fs.existsSync(sourceSdkPath)) throw new Error(`Lokale MSFS-SDK-Abhaengigkeit der TemplateApp fehlt: ${sourceSdkPath}`);
  const stat = fs.statSync(sourceSdkPath);
  if (stat.isDirectory()) {
    const destination = path.join(vendorTarget, 'microsoft-msfs-sdk');
    fs.cpSync(sourceSdkPath, destination, { recursive: true });
    targetSdkSpec = 'file:../vendor/microsoft-msfs-sdk';
  } else {
    const extension = path.extname(sourceSdkPath) || '.tgz';
    const destination = path.join(vendorTarget, `microsoft-msfs-sdk${extension}`);
    fs.copyFileSync(sourceSdkPath, destination);
    targetSdkSpec = `file:../vendor/${path.basename(destination)}`;
  }
}

const appPackagePath = path.join(targetSources, 'VfrMultitool', 'package.json');
const appPackage = JSON.parse(fs.readFileSync(appPackagePath, 'utf8'));
appPackage.dependencies['@microsoft/msfs-sdk'] = targetSdkSpec;
if (templateDependencies['@microsoft/msfs-types']) {
  appPackage.dependencies['@microsoft/msfs-types'] = templateDependencies['@microsoft/msfs-types'];
}
fs.writeFileSync(appPackagePath, `${JSON.stringify(appPackage, null, 2)}\n`, 'utf8');
console.log(`EFB-SDK-Eingaben vorbereitet: ${targetSources}`);
console.log(`MSFS-SDK-Abhaengigkeit aus der offiziellen TemplateApp uebernommen: ${targetSdkSpec}`);
