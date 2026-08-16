#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2022-11-28';

function usage() {
  return [
    'Usage:',
    '  node tools/publish-github-release.mjs --repo OWNER/REPO --tag TAG --title TITLE --asset FILE [options]',
    '',
    'Options:',
    '  --asset FILE          Release asset; may be repeated.',
    '  --notes TEXT          Release notes.',
    '  --notes-file FILE     Read release notes from a repository file.',
    '  --prerelease          Publish as a prerelease.',
    '  --latest VALUE        true, false, or legacy (default: false).',
    '  --dry-run             Validate inputs and print hashes without using GitHub.',
    '  --help                Show this help.'
  ].join('\n');
}

export function parseArgs(argv) {
  const result = {
    repo: '', tag: '', title: '', assets: [], notes: '', notesFile: '',
    prerelease: false, latest: 'false', dryRun: false, help: false
  };
  const valueOptions = new Map([
    ['--repo', 'repo'],
    ['--tag', 'tag'],
    ['--title', 'title'],
    ['--notes', 'notes'],
    ['--notes-file', 'notesFile'],
    ['--latest', 'latest']
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--prerelease') result.prerelease = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--asset') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--asset benötigt einen Dateipfad.');
      result.assets.push(value);
    } else if (valueOptions.has(arg)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} benötigt einen Wert.`);
      result[valueOptions.get(arg)] = value;
    } else {
      throw new Error(`Unbekannte Option: ${arg}`);
    }
  }
  return result;
}

export function parseGitCredential(raw) {
  const values = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

export function validateRepository(value) {
  const repo = String(value || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('--repo muss OWNER/REPO enthalten.');
  }
  return repo;
}

export function validateTag(value) {
  const tag = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(tag) || tag.includes('..') || tag.endsWith('/')) {
    throw new Error('--tag enthält keinen gültigen Git-Tag-Namen.');
  }
  return tag;
}

export function buildReleasePayload(options, draft = true) {
  return {
    tag_name: options.tag,
    name: options.title,
    body: options.notes,
    draft,
    prerelease: options.prerelease,
    make_latest: options.latest
  };
}

export function assetMatches(existing, local) {
  return existing?.name === local.name
    && Number(existing?.size) === local.size
    && String(existing?.digest || '').toLowerCase() === `sha256:${local.sha256}`;
}

function repositoryRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
}

function githubToken(repo) {
  let output = '';
  try {
    output = execFileSync('git', ['credential', 'fill'], {
      input: `protocol=https\nhost=github.com\npath=${repo}.git\n\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024
    });
  } catch (_) {
    throw new Error('Der Git-Credential-Store konnte nicht gelesen werden. Prüfe zuerst, ob "git push origin main" funktioniert.');
  }
  const credential = parseGitCredential(output);
  const token = String(credential.password || '').trim();
  output = '';
  if (!token) {
    throw new Error('Im Git-Credential-Store ist kein GitHub-Token vorhanden. Prüfe zuerst, ob "git push origin main" funktioniert.');
  }
  return token;
}

async function repositoryFile(root, requestedPath) {
  const rootReal = await realpath(root);
  const fileReal = await realpath(path.resolve(root, requestedPath));
  const relative = path.relative(rootReal, fileReal);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Datei liegt außerhalb des Repositories: ${requestedPath}`);
  }
  return { absolute: fileReal, relative: relative.split(path.sep).join('/') };
}

export async function inspectAsset(root, requestedPath) {
  const file = await repositoryFile(root, requestedPath);
  const info = await stat(file.absolute);
  if (!info.isFile()) throw new Error(`Release-Asset ist keine Datei: ${requestedPath}`);
  const data = await readFile(file.absolute);
  return {
    ...file,
    name: path.basename(file.absolute),
    size: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
    data
  };
}

async function githubRequest(token, url, options = {}) {
  const headers = {
    Accept: options.accept || 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'GA-Dispatcher-release-publisher',
    ...(options.headers || {})
  };
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch (_) { payload = { message: text.slice(0, 500) }; }
  }
  if (!response.ok && !(options.allow404 && response.status === 404)) {
    const message = String(payload?.message || response.statusText || 'GitHub-Anfrage fehlgeschlagen.');
    throw new Error(`GitHub API ${response.status}: ${message}`);
  }
  return { status: response.status, payload };
}

async function getRelease(token, repo, tag) {
  const result = await githubRequest(
    token,
    `${API_ROOT}/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    { allow404: true }
  );
  return result.status === 404 ? null : result.payload;
}

async function assertRemoteTag(token, repo, tag) {
  const result = await githubRequest(
    token,
    `${API_ROOT}/repos/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,
    { allow404: true }
  );
  if (result.status === 404) {
    throw new Error(`Der Tag ${tag} ist noch nicht auf GitHub vorhanden. Pushe zuerst "git push origin refs/tags/${tag}".`);
  }
  return result.payload;
}

async function createDraftRelease(token, repo, options) {
  const result = await githubRequest(token, `${API_ROOT}/repos/${repo}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildReleasePayload(options, true))
  });
  return result.payload;
}

async function uploadAsset(token, release, asset) {
  const uploadRoot = String(release?.upload_url || '').replace(/\{.*$/, '');
  if (!uploadRoot) throw new Error('GitHub hat keine Upload-URL für das Release geliefert.');
  const url = `${uploadRoot}?name=${encodeURIComponent(asset.name)}`;
  const result = await githubRequest(token, url, {
    method: 'POST',
    accept: 'application/vnd.github+json',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(asset.size)
    },
    body: asset.data
  });
  return result.payload;
}

async function publishDraft(token, repo, release, options) {
  const result = await githubRequest(token, `${API_ROOT}/repos/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildReleasePayload(options, false))
  });
  return result.payload;
}

function assertReleaseAsset(release, asset) {
  const existing = (Array.isArray(release?.assets) ? release.assets : []).find((entry) => entry.name === asset.name);
  if (!existing) return null;
  if (!assetMatches(existing, asset)) {
    throw new Error(`Release-Asset ${asset.name} existiert bereits, stimmt aber nicht mit Größe und SHA-256 des lokalen Builds überein. Es wird nicht ersetzt.`);
  }
  return existing;
}

async function resolveNotes(root, options) {
  if (options.notes && options.notesFile) throw new Error('--notes und --notes-file dürfen nicht gemeinsam verwendet werden.');
  if (!options.notesFile) return options.notes;
  const file = await repositoryFile(root, options.notesFile);
  return readFile(file.absolute, 'utf8');
}

async function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  options.repo = validateRepository(options.repo);
  options.tag = validateTag(options.tag);
  options.title = String(options.title || '').trim();
  if (!options.title) throw new Error('--title fehlt.');
  if (!options.assets.length) throw new Error('Mindestens ein --asset fehlt.');
  if (!['true', 'false', 'legacy'].includes(options.latest)) throw new Error('--latest muss true, false oder legacy sein.');

  const root = repositoryRoot();
  options.notes = await resolveNotes(root, options);
  const assets = [];
  for (const requestedPath of options.assets) assets.push(await inspectAsset(root, requestedPath));
  const duplicateNames = assets.filter((asset, index) => assets.findIndex((entry) => entry.name === asset.name) !== index);
  if (duplicateNames.length) throw new Error(`Doppelter Assetname: ${duplicateNames[0].name}`);

  const plan = {
    repo: options.repo,
    tag: options.tag,
    title: options.title,
    prerelease: options.prerelease,
    latest: options.latest,
    assets: assets.map(({ name, relative, size, sha256 }) => ({ name, path: relative, size, sha256 }))
  };
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  const token = githubToken(options.repo);
  await assertRemoteTag(token, options.repo, options.tag);
  let release = await getRelease(token, options.repo, options.tag);
  if (!release) {
    release = await createDraftRelease(token, options.repo, options);
    process.stdout.write(`Draft ${options.tag} angelegt.\n`);
  } else if (!release.draft) {
    if (release.prerelease !== options.prerelease) throw new Error(`Das vorhandene Release ${options.tag} hat einen anderen Prerelease-Status.`);
    process.stdout.write(`Release ${options.tag} ist bereits veröffentlicht; Assets werden nur verifiziert.\n`);
  }

  for (const asset of assets) {
    if (assertReleaseAsset(release, asset)) {
      process.stdout.write(`${asset.name}: vorhandenes Asset verifiziert.\n`);
      continue;
    }
    const uploaded = await uploadAsset(token, release, asset);
    if (!assetMatches(uploaded, asset)) {
      throw new Error(`GitHub hat für ${asset.name} nach dem Upload nicht die erwartete Größe und SHA-256 bestätigt.`);
    }
    process.stdout.write(`${asset.name}: Upload verifiziert.\n`);
    release = await getRelease(token, options.repo, options.tag) || release;
  }

  release = await getRelease(token, options.repo, options.tag) || release;
  for (const asset of assets) assertReleaseAsset(release, asset);
  if (release.draft) release = await publishDraft(token, options.repo, release, options);
  process.stdout.write(`${release.html_url || `https://github.com/${options.repo}/releases/tag/${options.tag}`}\n`);
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  run().catch((error) => {
    process.stderr.write(`Release fehlgeschlagen: ${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
