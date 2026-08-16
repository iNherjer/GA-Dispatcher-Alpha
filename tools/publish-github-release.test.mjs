import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assetMatches,
  buildReleasePayload,
  inspectAsset,
  parseArgs,
  parseGitCredential,
  validateRepository,
  validateTag
} from './publish-github-release.mjs';

test('parses release arguments without requiring gh state', () => {
  assert.deepEqual(parseArgs([
    '--repo', 'iNherjer/GA-Dispatcher-Alpha',
    '--tag', 'v355',
    '--title', 'Tracker v355 Alpha',
    '--asset', 'ga-tracker-client/VFR-Multitool-Tracker.exe',
    '--latest', 'false'
  ]), {
    repo: 'iNherjer/GA-Dispatcher-Alpha',
    tag: 'v355',
    title: 'Tracker v355 Alpha',
    assets: ['ga-tracker-client/VFR-Multitool-Tracker.exe'],
    notes: '',
    notesFile: '',
    prerelease: false,
    latest: 'false',
    dryRun: false,
    help: false
  });
});

test('parses credential values containing equals signs without exposing them', () => {
  assert.deepEqual(parseGitCredential('protocol=https\nhost=github.com\nusername=test\npassword=abc=def==\n'), {
    protocol: 'https',
    host: 'github.com',
    username: 'test',
    password: 'abc=def=='
  });
});

test('validates repository and tag inputs', () => {
  assert.equal(validateRepository('iNherjer/GA-Dispatcher-Alpha'), 'iNherjer/GA-Dispatcher-Alpha');
  assert.equal(validateTag('tracker-desktop-v1.2.3'), 'tracker-desktop-v1.2.3');
  assert.throws(() => validateRepository('https://github.com/example/repo'), /OWNER\/REPO/);
  assert.throws(() => validateTag('../secret'), /gültigen Git-Tag/);
});

test('builds a draft-first release payload', () => {
  assert.deepEqual(buildReleasePayload({
    tag: 'v355', title: 'Tracker v355 Alpha', notes: 'Homebase controls', prerelease: false, latest: 'false'
  }), {
    tag_name: 'v355',
    name: 'Tracker v355 Alpha',
    body: 'Homebase controls',
    draft: true,
    prerelease: false,
    make_latest: 'false'
  });
});

test('hashes assets and requires matching GitHub digest and size', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'github-release-publisher-'));
  const assetPath = path.join(root, 'tracker.exe');
  await writeFile(assetPath, 'tracker-v355');
  const local = await inspectAsset(root, 'tracker.exe');
  assert.equal(local.name, 'tracker.exe');
  assert.equal(local.size, 12);
  assert.equal(local.sha256, '6d9f53b5490cccac8ca546aa516f22e6d85fdb54f0848bb020df90f0c92fe6d8');
  assert.equal(assetMatches({ name: local.name, size: local.size, digest: `sha256:${local.sha256}` }, local), true);
  assert.equal(assetMatches({ name: local.name, size: local.size, digest: 'sha256:bad' }, local), false);
});
