#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(__dirname, 'gafor-sector-editor.html');
const PORT = Number(process.env.GAFOR_EDITOR_PORT || 8789);
const DEFAULT_BRANCH = 'main';
const DEFAULT_REL_PATH = 'data/gafor-sector-dataset-de.json';
const DRAFT_LOCAL_PATH = path.join(ROOT, 'data', 'gafor-sector-editor-draft.local.json');

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(html);
}

function readReqJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk || '');
      if (body.length > 10_000_000) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (_) {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d || ''); });
    child.stderr.on('data', (d) => { stderr += String(d || ''); });
    child.on('close', (code) => {
      resolve({ code: Number(code || 0), stdout, stderr });
    });
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: String(err && err.message ? err.message : err) });
    });
  });
}

function normalizeRepoSlugFromRemote(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const mHttp = raw.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (mHttp) return `${mHttp[1]}/${mHttp[2]}`;
  const mSsh = raw.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (mSsh) return `${mSsh[1]}/${mSsh[2]}`;
  return '';
}

function safeResolveInRepo(relPath) {
  const clean = String(relPath || DEFAULT_REL_PATH).replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, clean);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : `${ROOT}${path.sep}`;
  if (!(resolved === ROOT || resolved.startsWith(rootWithSep))) {
    throw new Error('invalid_path_outside_repo');
  }
  return { resolved, rel: clean };
}

async function readConfig() {
  const remote = await runCmd('git', ['remote', 'get-url', 'origin'], { cwd: ROOT });
  const repoSlug = remote.code === 0 ? normalizeRepoSlugFromRemote(remote.stdout.trim()) : '';
  return {
    ok: true,
    repoRoot: ROOT,
    repo: repoSlug || 'iNherjer/GA-Dispatcher-Alpha',
    branch: DEFAULT_BRANCH,
    path: DEFAULT_REL_PATH
  };
}

async function publishDatasetLocally(payload) {
  const dataset = payload && payload.dataset;
  if (!dataset || typeof dataset !== 'object') {
    return { ok: false, message: 'dataset fehlt oder ungueltig.' };
  }
  const branch = String(payload && payload.branch || DEFAULT_BRANCH).trim() || DEFAULT_BRANCH;
  const reqPath = String(payload && payload.path || DEFAULT_REL_PATH).trim() || DEFAULT_REL_PATH;
  const { resolved, rel } = safeResolveInRepo(reqPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const jsonText = `${JSON.stringify(dataset, null, 2)}\n`;
  await fs.writeFile(resolved, jsonText, 'utf8');

  const add = await runCmd('git', ['add', '--', rel], { cwd: ROOT });
  if (add.code !== 0) {
    return { ok: false, step: 'add', message: (add.stderr || add.stdout || '').trim() || 'git add fehlgeschlagen' };
  }
  const staged = await runCmd('git', ['diff', '--cached', '--name-only', '--', rel], { cwd: ROOT });
  if (staged.code !== 0) {
    return { ok: false, step: 'diff', message: (staged.stderr || staged.stdout || '').trim() || 'staged diff fehlgeschlagen' };
  }
  const stagedFiles = String(staged.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (!stagedFiles.length) {
    return { ok: true, noChanges: true, pushed: false, branch, path: rel, message: 'Keine Aenderungen zu pushen.' };
  }

  const msg = `Update GAFOR dataset (${new Date().toISOString()})`;
  const commit = await runCmd('git', ['commit', '-m', msg], { cwd: ROOT });
  if (commit.code !== 0) {
    return { ok: false, step: 'commit', message: (commit.stderr || commit.stdout || '').trim() || 'git commit fehlgeschlagen' };
  }
  const push = await runCmd('git', ['push', 'origin', branch], { cwd: ROOT });
  if (push.code !== 0) {
    return {
      ok: false,
      step: 'push',
      message: (push.stderr || push.stdout || '').trim() || 'git push fehlgeschlagen',
      commitMessage: msg
    };
  }
  return {
    ok: true,
    noChanges: false,
    pushed: true,
    branch,
    path: rel,
    commitMessage: msg,
    stagedFiles
  };
}

async function saveDraftLocallyOnDisk(payload) {
  const draft = payload && payload.draft;
  if (!draft || typeof draft !== 'object') {
    return { ok: false, message: 'draft fehlt oder ungueltig.' };
  }
  await fs.mkdir(path.dirname(DRAFT_LOCAL_PATH), { recursive: true });
  const text = `${JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    draft
  }, null, 2)}\n`;
  await fs.writeFile(DRAFT_LOCAL_PATH, text, 'utf8');
  return { ok: true, path: path.relative(ROOT, DRAFT_LOCAL_PATH) };
}

async function loadDraftFromDisk() {
  if (!existsSync(DRAFT_LOCAL_PATH)) {
    return { ok: false, message: 'Kein Server-Entwurf vorhanden.' };
  }
  try {
    const raw = await fs.readFile(DRAFT_LOCAL_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const draft = parsed && parsed.draft;
    if (!draft || typeof draft !== 'object') {
      return { ok: false, message: 'Server-Entwurf ungueltig.' };
    }
    return { ok: true, draft, path: path.relative(ROOT, DRAFT_LOCAL_PATH) };
  } catch (err) {
    return { ok: false, message: String(err && err.message ? err.message : err) };
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (!existsSync(HTML_PATH)) {
        sendJson(res, 404, { ok: false, message: 'Editor HTML nicht gefunden.' });
        return;
      }
      const html = await fs.readFile(HTML_PATH, 'utf8');
      sendHtml(res, html);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const cfg = await readConfig();
      sendJson(res, 200, cfg);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/publish') {
      const body = await readReqJson(req);
      const out = await publishDatasetLocally(body);
      sendJson(res, out.ok ? 200 : 400, out);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/draft') {
      const body = await readReqJson(req);
      const out = await saveDraftLocallyOnDisk(body);
      sendJson(res, out.ok ? 200 : 400, out);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/draft') {
      const out = await loadDraftFromDisk();
      sendJson(res, out.ok ? 200 : 404, out);
      return;
    }

    sendJson(res, 404, { ok: false, message: 'not_found' });
  } catch (err) {
    sendJson(res, 500, { ok: false, message: String(err && err.message ? err.message : err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[GAFOR-Editor] Server laeuft auf http://127.0.0.1:${PORT}`);
  console.log(`[GAFOR-Editor] Repo-Root: ${ROOT}`);
});
