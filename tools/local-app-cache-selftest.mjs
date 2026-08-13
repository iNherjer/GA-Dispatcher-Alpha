import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../serve.py', import.meta.url), 'utf8');

const cacheMatch = worker.match(/const CACHE = '(ga-dispatcher-v\d+)'/);
assert.ok(cacheMatch, 'service worker cache version missing');
const cacheVersion = cacheMatch[1];
assert.ok(app.includes(`sw.js?v=${cacheVersion}`), 'app.js must request the active service worker version');
assert.match(index, /window\.__gaLocalDevNoSw = localDev/);
assert.match(index, /\^192\\\.168\\\./);
assert.match(index, /getRegistrations\(\)[\s\S]*?reg\.unregister\(\)/);
assert.match(index, /\^ga-dispatcher-/);
assert.match(index, /const _skipSwForDebug = window\.__gaLocalDevNoSw === true/);
assert.match(server, /Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'/);

console.log(`Local-App-Cache-Selftest: OK (${cacheVersion}, private local hosts run without Service Worker).`);
