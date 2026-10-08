// Read-only preparation aid. Lists parameter declarations; does not call any API.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--ref')) {
  throw new Error('Usage: node tools/gemini-parameter-audit.mjs [--ref <git-ref>]');
}
const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').trim();
const ref = args[1] ? git('rev-parse', '--verify', `${args[1]}^{commit}`).trim() : null;
const files = (ref
  ? git('ls-tree', '-r', '--name-only', ref)
  : git('ls-files', '--cached', '--others', '--exclude-standard'))
  .trim().split('\n').filter(Boolean);
const relevant = [...new Set(files)].filter(file => /\.(?:js|mjs|cjs)$/.test(file)
  && !/(?:^|\/)(?:node_modules|analysis|dist|vendor|efb-web-assets)\//.test(file)
  && !/(?:\.test\.|selftest|gemini-parameter-audit)/.test(file));
const rows = [];
const field = /(?:^|[\s,{])(?:["']?)(temperature|topP|topK|top_p|top_k|thinkingBudget|thinking_budget|thinkingLevel|thinking_level)(?:["']?)\s*:/g;
for (const file of relevant) {
  const source = ref ? git('show', `${ref}:${file}`) : readFileSync(`${root}/${file}`, 'utf8');
  // Source scan only: an occurrence is not proof that a parameter reaches Gemini.
  source.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(field)) rows.push({ file, line: index + 1, field: match[1] });
  });
}
console.log(JSON.stringify({
  schema: 'ga.gemini-parameter-audit.v1',
  source: ref || 'working-tree',
  scannedFiles: relevant.length,
  note: 'Declaration inventory, not a request-level regression test. Other providers and historical probes require manual classification. No network requests or secrets are printed.',
  declarations: rows
}, null, 2));
