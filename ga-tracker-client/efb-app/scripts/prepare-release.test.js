'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  EFB_PACKAGE_NAME,
  EFB_REQUIRED_FILES
} = require('../../desktop/lib/efb-package-manager');
const { createDescriptor, verifyArchive, zipPackage } = require('./prepare-release');

function writePackage(packageRoot) {
  const content = [];
  for (const relative of EFB_REQUIRED_FILES) {
    const file = path.join(packageRoot, ...relative.split('/'));
    const value = Buffer.from(`fixture:${relative}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
    content.push({ path: relative, size: value.length, date: 0 });
  }
  fs.writeFileSync(path.join(packageRoot, 'manifest.json'), JSON.stringify({ package_version: '0.1.0' }));
  fs.writeFileSync(path.join(packageRoot, 'layout.json'), JSON.stringify({ content }));
}

test('EFB release preparation emits an immutable channel descriptor', () => {
  const archive = Buffer.from('sdk-built-package-fixture');
  const descriptor = createDescriptor('alpha', '0.1.0', archive);
  assert.equal(descriptor.releaseTag, 'efb-app-v0.1.0');
  assert.equal(descriptor.archive.name, 'vfr-multitool-efb-0.1.0.zip');
  assert.equal(descriptor.archive.size, archive.length);
  assert.match(descriptor.archive.sha256, /^[a-f0-9]{64}$/);
  assert.equal(descriptor.archive.url, 'https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/download/efb-app-v0.1.0/vfr-multitool-efb-0.1.0.zip');
});

test('EFB release archive keeps one validated package root', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-efb-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packageRoot = path.join(root, EFB_PACKAGE_NAME);
  const archivePath = path.join(root, `${EFB_PACKAGE_NAME}-0.1.0.zip`);
  fs.mkdirSync(packageRoot, { recursive: true });
  writePackage(packageRoot);
  zipPackage(packageRoot, archivePath);
  assert.doesNotThrow(() => verifyArchive(fs.readFileSync(archivePath), '0.1.0'));
});
