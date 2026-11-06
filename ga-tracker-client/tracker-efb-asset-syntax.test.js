'use strict';
// The MSFS EFB and toolbar (Coherent) run every script the tracker serves as is.
// Coherent rejects newer syntax: one object spread in map-live-presentation.js
// stopped the whole EFB map on 06.11.2026 ("Unexpected token '...'"). Generated
// files under efb-web-assets/ are transpiled; files served straight from the
// project must stay within what Coherent understands.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { getTrackerEfbWebClientAsset } = require('./tracker-efb-web-client');

const source = fs.readFileSync(path.join(__dirname, 'tracker-efb-web-client.js'), 'utf8');
const scripts = [...new Set((source.match(/'\/efb\/v1\/assets\/[^']+\.js'/g) || []).map(s => s.slice(1, -1)))];

function unsupported(code) {
  const ast = parse(code, { sourceType: 'script', errorRecovery: true });
  const hits = [];
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    const at = n.loc ? n.loc.start.line : '?';
    if (n.type === 'ObjectExpression' && n.properties.some(p => p.type === 'SpreadElement')) hits.push(at + ': object spread { ...x }');
    if (n.type === 'ObjectPattern' && n.properties.some(p => p.type === 'RestElement')) hits.push(at + ': object rest { ...x } =');
    if (n.type === 'OptionalMemberExpression' || n.type === 'OptionalCallExpression') hits.push(at + ': optional chaining ?.');
    if (n.type === 'LogicalExpression' && n.operator === '??') hits.push(at + ': nullish ??');
    if (n.type === 'AssignmentExpression' && ['??=', '||=', '&&='].includes(n.operator)) hits.push(at + ': logical assignment ' + n.operator);
    for (const key of Object.keys(n)) {
      if (key === 'loc') continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
    }
  })(ast.program);
  return hits;
}

test('every script the tracker serves to the EFB avoids syntax Coherent rejects', () => {
  assert.ok(scripts.length > 30, 'asset list found');
  const problems = [];
  for (const pathname of scripts) {
    const asset = getTrackerEfbWebClientAsset(pathname);
    if (!asset) continue;
    const hits = unsupported(String(asset.body));
    if (hits.length) problems.push(pathname + ' -> ' + hits.slice(0, 5).join(', '));
  }
  assert.deepEqual(problems, []);
});
