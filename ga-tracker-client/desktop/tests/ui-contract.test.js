const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const desktopRoot = path.resolve(__dirname, '..');

test('renderer element bindings exist in the desktop HTML', () => {
  const renderer = fs.readFileSync(path.join(desktopRoot, 'ui', 'renderer.js'), 'utf8');
  const html = fs.readFileSync(path.join(desktopRoot, 'ui', 'index.html'), 'utf8');
  const ids = Array.from(renderer.matchAll(/getElementById\('([^']+)'\)/g), (match) => match[1]);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.match(html, new RegExp(`id=["']${id}["']`), `Fehlendes UI-Element: ${id}`);
});

test('PIN input accepts the same 4-to-8-digit range as the web app', () => {
  const html = fs.readFileSync(path.join(desktopRoot, 'ui', 'index.html'), 'utf8');
  const pinInput = html.match(/<input\s+id="pinInput"[^>]*>/)?.[0] || '';
  assert.match(pinInput, /pattern="\[0-9\]\{4,8\}"/);
  assert.match(pinInput, /minlength="4"/);
  assert.match(pinInput, /maxlength="8"/);
});

test('renderer only calls desktop methods exposed by the preload bridge', () => {
  const renderer = fs.readFileSync(path.join(desktopRoot, 'ui', 'renderer.js'), 'utf8');
  const preload = fs.readFileSync(path.join(desktopRoot, 'preload.js'), 'utf8');
  const methods = Array.from(new Set(Array.from(renderer.matchAll(/trackerDesktop\.([A-Za-z0-9_]+)/g), (match) => match[1])));
  for (const method of methods) assert.match(preload, new RegExp(`\\b${method}\\s*:`), `Fehlende Preload-Methode: ${method}`);
});

test('status controls stay visible while modules are closed and ordered', () => {
  const html = fs.readFileSync(path.join(desktopRoot, 'ui', 'index.html'), 'utf8');
  const modules = Array.from(html.matchAll(/<details class="module-panel" data-module-panel>/g));
  assert.equal(modules.length, 4);
  assert.doesNotMatch(html, /<details class="module-panel"[^>]*\sopen(?:\s|>)/);
  const start = html.indexOf('id="startButton"');
  const tracker = html.indexOf('<strong>Tracker</strong>');
  const homebase = html.indexOf('<strong>Homebase Asset Pack</strong>');
  const efb = html.indexOf('<strong>VFR Multitool EFB</strong>');
  const bridge = html.indexOf('<strong>AccuSim Telemetry Bridge</strong>');
  assert.ok(start >= 0 && start < tracker);
  assert.ok(tracker < homebase && homebase < efb && efb < bridge);
});

test('desktop window and Windows build use the dedicated tracker icon', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.build.win.icon, 'assets/tracker-icon-512.png');
  assert.ok(fs.existsSync(path.join(desktopRoot, 'assets', 'tracker-icon-512.png')));
  assert.ok(fs.existsSync(path.join(desktopRoot, 'assets', 'tracker-icon-192.png')));
});

test('Windows build packages the desktop self-updater and immutable channel', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
  const main = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');
  assert.equal(packageJson.dependencies['electron-updater'], '6.8.9');
  assert.equal(packageJson.build.publish[0].provider, 'generic');
  assert.match(packageJson.build.publish[0].url, /ga-tracker-client\/channel\/desktop\/$/);
  assert.match(main, /require\('electron-updater'\)/);
  assert.match(main, /desktopUpdateController\.checkAtStartup\(\)/);
});
