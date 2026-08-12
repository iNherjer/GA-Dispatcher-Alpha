import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../serve.py', import.meta.url), 'utf8');

assert.match(worker, /const CACHE = 'ga-dispatcher-v1620'/);
assert.match(app, /sw\.js\?v=ga-dispatcher-v1620/);
assert.match(index, /window\.__gaLocalDevNoSw = localDev/);
assert.match(index, /\^192\\\.168\\\./);
assert.match(index, /getRegistrations\(\)[\s\S]*?reg\.unregister\(\)/);
assert.match(index, /\^ga-dispatcher-/);
assert.match(index, /const _skipSwForDebug = window\.__gaLocalDevNoSw === true/);
assert.match(server, /Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'/);

console.log('Local-App-Cache-Selftest: OK (v1620, private local hosts run without Service Worker).');
