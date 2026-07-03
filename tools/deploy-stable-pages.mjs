#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_DOMAIN = 'www.vfr-multitool.de';
const DEFAULT_ORIGIN_REMOTE = 'origin';
const DEFAULT_STABLE_REMOTE = 'stable';
const DEFAULT_SOURCE_REF = 'refs/heads/main';
const DEFAULT_TARGET_REF = 'refs/heads/main';
const DEFAULT_STABLE_PAGES_REPO = 'iNherjer/VFR-Multitool';

function parseArgs(argv) {
  const args = {
    domain: DEFAULT_DOMAIN,
    originRemote: DEFAULT_ORIGIN_REMOTE,
    stableRemote: DEFAULT_STABLE_REMOTE,
    sourceRef: DEFAULT_SOURCE_REF,
    targetRef: DEFAULT_TARGET_REF,
    stablePagesRepo: DEFAULT_STABLE_PAGES_REPO,
    dryRun: false,
    skipPagesBuild: false,
    allowOverwrite: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i] || '';
    if (arg === '--domain') args.domain = next();
    else if (arg.startsWith('--domain=')) args.domain = arg.slice('--domain='.length);
    else if (arg === '--origin-remote') args.originRemote = next();
    else if (arg.startsWith('--origin-remote=')) args.originRemote = arg.slice('--origin-remote='.length);
    else if (arg === '--stable-remote') args.stableRemote = next();
    else if (arg.startsWith('--stable-remote=')) args.stableRemote = arg.slice('--stable-remote='.length);
    else if (arg === '--source-ref') args.sourceRef = next();
    else if (arg.startsWith('--source-ref=')) args.sourceRef = arg.slice('--source-ref='.length);
    else if (arg === '--target-ref') args.targetRef = next();
    else if (arg.startsWith('--target-ref=')) args.targetRef = arg.slice('--target-ref='.length);
    else if (arg === '--stable-pages-repo') args.stablePagesRepo = next();
    else if (arg.startsWith('--stable-pages-repo=')) args.stablePagesRepo = arg.slice('--stable-pages-repo='.length);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--skip-pages-build') args.skipPagesBuild = true;
    else if (arg === '--allow-overwrite') args.allowOverwrite = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  args.domain = String(args.domain || '').trim();
  if (!args.domain) throw new Error('Missing --domain value.');
  return args;
}

function printHelp() {
  console.log(`Usage: node tools/deploy-stable-pages.mjs [options]

Deploy stable/main from origin/main while preserving the GitHub Pages custom domain.
The script creates a temporary commit based on origin/main with only a root CNAME file.

Options:
  --domain <host>              Custom domain for CNAME (default: ${DEFAULT_DOMAIN})
  --origin-remote <name>       Source remote (default: ${DEFAULT_ORIGIN_REMOTE})
  --stable-remote <name>       Stable remote (default: ${DEFAULT_STABLE_REMOTE})
  --source-ref <ref>           Source ref on origin remote (default: ${DEFAULT_SOURCE_REF})
  --target-ref <ref>           Target ref on stable remote (default: ${DEFAULT_TARGET_REF})
  --stable-pages-repo <owner/repo>
                               Repo used for optional Pages rebuild trigger
                               (default: ${DEFAULT_STABLE_PAGES_REPO})
  --dry-run                    Create and validate the overlay commit but do not push
  --skip-pages-build           Do not trigger a GitHub Pages rebuild via gh api
  --allow-overwrite            Allow stable-only commits touching files other than CNAME
`);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 && !options.allowFailure) {
    const suffix = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}${suffix ? `\n${suffix}` : ''}`);
  }
  return result;
}

function git(args, options = {}) {
  return run('git', args, options);
}

function output(cmd, args, options = {}) {
  return run(cmd, args, options).stdout.trim();
}

function gitOutput(args, options = {}) {
  return output('git', args, options);
}

function shortSha(sha) {
  return String(sha || '').slice(0, 8);
}

function parseLsRemote(text, ref) {
  const line = String(text || '').split(/\r?\n/).find((entry) => entry.endsWith(`\t${ref}`));
  if (!line) throw new Error(`Remote ref not found: ${ref}`);
  return line.split(/\s+/)[0];
}

function remoteSha(remote, ref, repoRoot) {
  return parseLsRemote(gitOutput(['ls-remote', remote, ref], { cwd: repoRoot }), ref);
}

function ensureCommitAvailable(repoRoot, remote, ref, sha, trackingRef) {
  const check = git(['cat-file', '-e', `${sha}^{commit}`], { cwd: repoRoot, allowFailure: true });
  if (check.status === 0) return;
  git(['fetch', '--no-tags', remote, `+${ref}:${trackingRef}`], { cwd: repoRoot });
  git(['cat-file', '-e', `${sha}^{commit}`], { cwd: repoRoot });
}

function safeTrackingRef(remote, ref) {
  const name = ref.replace(/^refs\/heads\//, '').replace(/[^A-Za-z0-9._/-]/g, '-');
  return `refs/remotes/${remote}/${name}`;
}

function changedFilesForCommit(repoRoot, sha) {
  const raw = gitOutput(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', sha], { cwd: repoRoot });
  return raw ? raw.split(/\r?\n/).filter(Boolean) : [];
}

function assertStableOnlyTouchesCname(repoRoot, stableSha, sourceSha, allowOverwrite) {
  const raw = gitOutput(['rev-list', '--left-only', `${stableSha}...${sourceSha}`], { cwd: repoRoot });
  const stableOnly = raw ? raw.split(/\r?\n/).filter(Boolean) : [];
  if (!stableOnly.length) return;

  const unsafe = [];
  for (const sha of stableOnly) {
    const files = changedFilesForCommit(repoRoot, sha);
    if (files.some((file) => file !== 'CNAME')) {
      unsafe.push({ sha, files });
    }
  }
  if (!unsafe.length) return;
  if (allowOverwrite) {
    console.warn('[warn] Stable-only commits touch non-CNAME files; continuing because --allow-overwrite is set.');
    for (const item of unsafe) console.warn(`[warn] ${shortSha(item.sha)}: ${item.files.join(', ')}`);
    return;
  }
  const detail = unsafe.map((item) => `${shortSha(item.sha)}: ${item.files.join(', ')}`).join('\n');
  throw new Error(`Refusing to overwrite stable-only non-CNAME changes. Re-run with --allow-overwrite only if intended.\n${detail}`);
}

function isStableAlreadyOverlay(repoRoot, stableSha, sourceSha, domain) {
  const parent = gitOutput(['rev-parse', `${stableSha}^`], { cwd: repoRoot, allowFailure: true });
  if (parent !== sourceSha) return false;
  const cname = gitOutput(['show', `${stableSha}:CNAME`], { cwd: repoRoot, allowFailure: true });
  return cname.trim() === domain;
}

function createOverlayCommit(repoRoot, sourceSha, domain) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-stable-pages-'));
  const worktreePath = path.join(tempRoot, 'worktree');
  let worktreeAdded = false;
  try {
    git(['worktree', 'add', '--detach', worktreePath, sourceSha], { cwd: repoRoot, stdio: 'pipe' });
    worktreeAdded = true;
    fs.writeFileSync(path.join(worktreePath, 'CNAME'), `${domain}\n`, 'utf8');
    git(['add', 'CNAME'], { cwd: worktreePath });

    const diff = git(['diff', '--cached', '--quiet'], { cwd: worktreePath, allowFailure: true });
    if (diff.status === 0) return sourceSha;

    git([
      'commit',
      '-m',
      'Preserve stable Pages custom domain',
      '-m',
      `Stable deploy overlay for ${sourceSha} with CNAME ${domain}.`
    ], {
      cwd: worktreePath,
      env: {
        GIT_AUTHOR_NAME: 'GA Dispatcher Deploy',
        GIT_AUTHOR_EMAIL: 'deploy@vfr-multitool.local',
        GIT_COMMITTER_NAME: 'GA Dispatcher Deploy',
        GIT_COMMITTER_EMAIL: 'deploy@vfr-multitool.local'
      }
    });
    return gitOutput(['rev-parse', 'HEAD'], { cwd: worktreePath });
  } finally {
    if (worktreeAdded) {
      git(['worktree', 'remove', '--force', worktreePath], { cwd: repoRoot, allowFailure: true });
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function triggerPagesBuild(repo, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] Would trigger GitHub Pages build for ${repo}.`);
    return;
  }
  const result = run('gh', ['api', '-X', 'POST', `repos/${repo}/pages/builds`], { allowFailure: true });
  if (result.status !== 0) {
    console.warn(`[warn] Could not trigger Pages build for ${repo}. Push succeeded; GitHub may still start Pages automatically.`);
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    if (detail) console.warn(detail);
    return;
  }
  const text = result.stdout.trim();
  console.log(`Triggered GitHub Pages build for ${repo}${text ? `: ${text}` : '.'}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = gitOutput(['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
  const sourceTrackingRef = safeTrackingRef(args.originRemote, args.sourceRef);
  const stableTrackingRef = safeTrackingRef(args.stableRemote, args.targetRef);

  const sourceSha = remoteSha(args.originRemote, args.sourceRef, repoRoot);
  const stableSha = remoteSha(args.stableRemote, args.targetRef, repoRoot);

  ensureCommitAvailable(repoRoot, args.originRemote, args.sourceRef, sourceSha, sourceTrackingRef);
  ensureCommitAvailable(repoRoot, args.stableRemote, args.targetRef, stableSha, stableTrackingRef);

  assertStableOnlyTouchesCname(repoRoot, stableSha, sourceSha, args.allowOverwrite);

  if (isStableAlreadyOverlay(repoRoot, stableSha, sourceSha, args.domain)) {
    console.log(`stable ${shortSha(stableSha)} already deploys ${shortSha(sourceSha)} with CNAME ${args.domain}.`);
    if (!args.skipPagesBuild) triggerPagesBuild(args.stablePagesRepo, args.dryRun);
    return;
  }

  const deploySha = createOverlayCommit(repoRoot, sourceSha, args.domain);
  console.log(`source ${args.originRemote}/${args.sourceRef}: ${sourceSha}`);
  console.log(`stable current ${args.stableRemote}/${args.targetRef}: ${stableSha}`);
  console.log(`stable deploy overlay: ${deploySha} (CNAME ${args.domain})`);

  const lease = `--force-with-lease=${args.targetRef}:${stableSha}`;
  const refspec = `${deploySha}:${args.targetRef}`;
  if (args.dryRun) {
    console.log(`[dry-run] Would run: git push ${lease} ${args.stableRemote} ${refspec}`);
  } else {
    git(['push', lease, args.stableRemote, refspec], { cwd: repoRoot, stdio: 'inherit' });
    const afterSha = remoteSha(args.stableRemote, args.targetRef, repoRoot);
    if (afterSha !== deploySha) throw new Error(`Stable verification failed: expected ${deploySha}, got ${afterSha}`);
    console.log(`Verified stable ${args.targetRef}: ${afterSha}`);
  }

  if (!args.skipPagesBuild) triggerPagesBuild(args.stablePagesRepo, args.dryRun);
}

try {
  main();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
