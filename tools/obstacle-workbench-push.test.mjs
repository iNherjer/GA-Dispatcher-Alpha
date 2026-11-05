import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('./obstacle-tile-workbench-server.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function handlePush() {');
const handler = source.slice(start, source.indexOf('\nfunction parseBody(req)', start));

test('push recovery transfers existing commits and confirms the remote commit', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-workbench-push-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'repo');
  const bare = path.join(tmp, 'remote.git');
  fs.mkdirSync(root);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
  const git = (args, cwd = root) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '--bare', bare]);
  git(['init', '-b', 'tile-workbench']);
  git(['config', 'user.name', 'Workbench Test']);
  git(['config', 'user.email', 'workbench-test@example.invalid']);
  git(['remote', 'add', 'origin', bare]);
  for (const layer of ['core', 'poi', 'infra']) {
    const dir = path.join(root, 'obstacles', `${layer}-tiles`, '304');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '421.json'), '{}\n');
  }
  git(['add', 'obstacles']);
  git(['commit', '-m', 'initial']);
  git(['push', '-u', 'origin', 'HEAD:tile-workbench']);
  let failPush = false;
  let failVerify = false;
  let calls = [];
  const ctx = {
    pushStatus: { running: false }, processing: false, currentTile: null, queue: [],
    infraEnrichProcessing: false, infraEnrichCurrentTile: null, infraEnrichQueue: [],
    ROOT: root, WORKBENCH_PUSH_REMOTE: 'origin', WORKBENCH_PUSH_BRANCH: 'tile-workbench',
    WORKBENCH_PUSH_REF: 'origin/tile-workbench', path, existsSync: fs.existsSync,
    setPushStatus: value => Object.assign(ctx.pushStatus, value),
    getTileGitStatus: async () => ({ ok: true, lines: git(['status', '--porcelain', '--', 'obstacles']).split('\n').filter(Boolean) }),
    getRemoteSyncState: async () => {
      git(['fetch', 'origin', 'tile-workbench']);
      const [behind, ahead] = git(['rev-list', '--left-right', '--count', 'origin/tile-workbench...HEAD']).split(/\s+/).map(Number);
      return { ok: true, ahead, behind, remoteRef: 'origin/tile-workbench' };
    },
    runCmd: async (cmd, args) => {
      calls.push(args);
      if (args[0] === 'push' && failPush) return { code: 1, stdout: '', stderr: 'simulated network failure' };
      if (args[0] === 'ls-remote' && failVerify) return { code: 0, stdout: `${'0'.repeat(40)}\trefs/heads/tile-workbench\n`, stderr: '' };
      try { return { code: 0, stdout: git(args), stderr: '' }; }
      catch (e) { return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') }; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(handler, ctx);
  const run = () => { calls = []; return vm.runInContext('handlePush()', ctx); };
  const change = value => fs.writeFileSync(path.join(root, 'obstacles/core-tiles/304/421.json'), JSON.stringify({ value }));
  const head = () => git(['rev-parse', 'HEAD']);
  const remoteHead = () => git(['rev-parse', 'refs/heads/tile-workbench'], bare);

  await t.test('synchronized repository does not create a commit', async () => {
    const before = head();
    assert.equal((await run()).ok, true);
    assert.equal(head(), before);
    assert.equal(calls.some(a => a[0] === 'commit' || a[0] === 'push'), false);
  });
  await t.test('failed push leaves a recoverable local commit', async () => {
    change(1); failPush = true;
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.step, 'push');
    assert.notEqual(head(), remoteHead());
    assert.equal(git(['status', '--porcelain']), '');
  });
  await t.test('retry with no new files pushes that same commit', async () => {
    failPush = false;
    const pending = head();
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.commitHash, pending);
    assert.equal(result.stagedFiles.length, 0);
    assert.equal(head(), pending);
    assert.equal(remoteHead(), pending);
    assert.equal(calls.some(a => a[0] === 'commit'), false);
    assert.equal(calls.some(a => a[0] === 'push'), true);
    assert.equal(calls.some(a => a[0] === 'ls-remote'), true);
  });
  await t.test('new changes and earlier unpublished commits are transferred together', async () => {
    change(2); git(['add', 'obstacles']); git(['commit', '-m', 'earlier unpublished tile']);
    change(3);
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.aheadBeforePush, 1);
    assert.equal(result.stagedFiles.length, 1);
    assert.equal(remoteHead(), head());
  });
  await t.test('remote hash mismatch cannot report success', async () => {
    change(4); failVerify = true;
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.step, 'verify');
    assert.equal(ctx.pushStatus.ok, false);
  });
});
