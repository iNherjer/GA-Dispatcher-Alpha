#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublisher } from './publisher-core.mjs';

const APP_VERSION = '0.4.0';
const SOURCE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DISTRIBUTION_ROOT = path.resolve(
  process.env.HOMEBASE_ASSET_PUBLISHER_ROOT
    || (process.pkg ? path.dirname(process.execPath) : SOURCE_ROOT)
);
const WEB_ROOT = path.join(DISTRIBUTION_ROOT, 'web');
const SEED_ROOT = path.join(DISTRIBUTION_ROOT, 'seed');
const DATA_ROOT_POINTER = path.join(DISTRIBUTION_ROOT, 'PUBLISHER-DATA-ROOT.txt');
const POINTER_DATA_ROOT = fs.existsSync(DATA_ROOT_POINTER)
  ? fs.readFileSync(DATA_ROOT_POINTER, 'utf8').trim()
  : '';
const DATA_ROOT = path.resolve(
  process.env.HOMEBASE_ASSET_PUBLISHER_DATA
    || POINTER_DATA_ROOT
    || path.join(DISTRIBUTION_ROOT, 'Homebase-Asset-Publisher-Data')
);
const STARTUP_LOG = path.join(DISTRIBUTION_ROOT, 'Homebase-Asset-Publisher-startup.log');
const TOOL_PATHS = [
  path.join(DISTRIBUTION_ROOT, 'tools', 'gh', 'Program Files', 'GitHub CLI'),
  'C:\\Program Files\\Git\\cmd'
].filter((directory) => fs.existsSync(directory));
process.env.PATH = [...TOOL_PATHS, process.env.PATH || ''].join(path.delimiter);

// Migrate the previously shipped publisher layout once, preserving every existing raw source.
const legacyConfig = path.join(DATA_ROOT, 'config.json');
const configPath = path.join(DATA_ROOT, 'publisher-config.json');
const legacySources = path.join(DATA_ROOT, 'PackageSources');
const sourceRoot = path.join(DATA_ROOT, 'source');
if (!fs.existsSync(configPath) && fs.existsSync(legacyConfig)) fs.copyFileSync(legacyConfig, configPath);
if (!fs.existsSync(sourceRoot) && fs.existsSync(legacySources)) fs.cpSync(legacySources, sourceRoot, { recursive: true });

function startupLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try { fs.appendFileSync(STARTUP_LOG, line, 'utf8'); } catch (_) {}
}

function fatalMessage(error) {
  const message = error?.stack || error?.message || String(error);
  startupLog(`FATAL ${message}`);
  console.error('\nHomebase Asset Publisher konnte nicht gestartet werden.');
  console.error(message);
  console.error(`\nDiagnose: ${STARTUP_LOG}`);
}

process.on('uncaughtException', (error) => {
  fatalMessage(error);
  process.exitCode = 1;
});
process.on('unhandledRejection', (error) => {
  fatalMessage(error);
  process.exitCode = 1;
});

startupLog(`START version=${APP_VERSION} exe=${process.execPath} root=${DISTRIBUTION_ROOT}`);
let publisher;
try {
  publisher = createPublisher({ distributionRoot: DISTRIBUTION_ROOT, seedRoot: SEED_ROOT, dataRoot: DATA_ROOT });
} catch (error) {
  fatalMessage(error);
  process.exit(1);
}
const config = publisher.getConfig();
const PORT = Number(process.env.HOMEBASE_ASSET_PUBLISHER_PORT || config.port || 8797);
const HOST = '127.0.0.1';

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml']
]);

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2 * 1024 * 1024) throw new Error('Anfrage ist zu groÃŸ.');
  }
  return body ? JSON.parse(body) : {};
}

function serveStatic(urlPath, res) {
  const relative = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.resolve(WEB_ROOT, relative);
  const prefix = `${path.resolve(WEB_ROOT)}${path.sep}`;
  if (!file.startsWith(prefix) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
    return;
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
}

function openPath(target) {
  if (process.platform === 'win32') execFile('explorer.exe', [target], { windowsHide: true });
  else if (process.platform === 'darwin') execFile('open', [target]);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true, app: 'homebase-asset-publisher', version: APP_VERSION });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      sendJson(res, 200, { ok: true, ...publisher.status() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/config') {
      sendJson(res, 200, { ok: true, config: publisher.saveConfig(await readJson(req)) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/catalog/version') {
      const body = await readJson(req);
      sendJson(res, 200, { ok: true, catalog: publisher.setPackageVersion(body.version) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/assets/inspect') {
      sendJson(res, 200, { ok: true, ...publisher.inspectSourceAssets(await readJson(req)) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/assets/import') {
      sendJson(res, 200, { ok: true, ...publisher.importAsset(await readJson(req)) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/project/prepare') {
      sendJson(res, 200, { ok: true, ...publisher.prepareProject() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/build') {
      sendJson(res, 200, { ok: true, ...publisher.buildPackage() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/release/prepare') {
      const body = await readJson(req);
      const result = publisher.prepareRelease(body);
      sendJson(res, 200, {
        ok: true,
        releaseRoot: result.releaseRoot,
        indexPath: result.indexPath,
        packageVersion: result.index.packageVersion,
        changedAssets: result.index.changedAssets,
        removedAssets: result.index.removedAssets,
        fullArchive: result.index.fullArchive,
        assetArchives: result.index.assets.map((asset) => ({ key: asset.key, changed: asset.changed, archive: asset.archive }))
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/publish') {
      sendJson(res, 200, { ok: true, ...publisher.publishRelease(await readJson(req)) });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/open-path') {
      const body = await readJson(req);
      const allowed = new Set(Object.values(publisher.paths).map((item) => path.resolve(item)));
      const requested = path.resolve(String(body.path || ''));
      const insideData = requested === path.resolve(publisher.paths.dataRoot) || requested.startsWith(`${path.resolve(publisher.paths.dataRoot)}${path.sep}`);
      if (!insideData && !allowed.has(requested)) throw new Error('Dieser Pfad darf nicht Ã¼ber den Publisher geÃ¶ffnet werden.');
      openPath(requested);
      sendJson(res, 200, { ok: true, path: requested });
      return;
    }
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      serveStatic(url.pathname, res);
      return;
    }
    sendJson(res, 404, { ok: false, error: 'Unbekannte Publisher-Aktion.' });
  } catch (error) {
    const code = error?.code || '';
    const status = code === 'SIM_RUNNING' || code === 'CONFIRMATION_REQUIRED' ? 409 : 400;
    sendJson(res, status, { ok: false, code, error: error?.message || String(error) });
  }
});

server.on('error', (error) => {
  fatalMessage(error);
  if (error?.code === 'EADDRINUSE') console.error(`Port ${PORT} wird bereits verwendet. Eine vorhandene Publisher-Instanz schlieÃŸen oder HOMEBASE_ASSET_PUBLISHER_PORT Ã¤ndern.`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  startupLog(`READY url=${url} data=${DATA_ROOT}`);
  console.log(`VFR Multitool Homebase Asset Publisher ${APP_VERSION}`);
  console.log(`OberflÃ¤che: ${url}`);
  console.log(`Arbeitsdaten: ${DATA_ROOT}`);
  console.log('Dieses Fenster wÃ¤hrend der Arbeit geÃ¶ffnet lassen.');
  if (process.platform === 'win32' && !process.argv.includes('--no-open') && process.env.HOMEBASE_ASSET_PUBLISHER_NO_OPEN !== '1') {
    setTimeout(() => execFile('cmd.exe', ['/c', 'start', '', url], { windowsHide: true }), 500);
  }
});
