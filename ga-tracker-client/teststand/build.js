'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'dist', 'GA-Mission-Teststand-v388.exe'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-teststand-build-'));
try {
  execFileSync(process.execPath, [path.join(root, 'sync-efb-web-assets.js')], { stdio: 'inherit' });
  const config = path.join(temp, 'package.json');
  fs.writeFileSync(config, JSON.stringify({ name: 'ga-mission-teststand', version: '1.0.0', pkg: {
    assets: [...pkg.pkg.assets.map(asset => path.resolve(root, asset)), path.join(__dirname, 'index.html')],
    scripts: [path.join(root, 'tracker.js'), path.join(root, 'tracker-storage.js')]
  } }));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync(process.execPath, [path.join(root, 'node_modules/@yao-pkg/pkg/lib-es5/bin.js'), path.join(__dirname, 'start.js'), '--config', config, '--target', 'node18-win-x64', '--output', output], { cwd: root, stdio: 'inherit' });
  console.log(`Teststand-EXE: ${output}`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
