'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('generated EFB web assets match their sources', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'sync-efb-web-assets.js'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
