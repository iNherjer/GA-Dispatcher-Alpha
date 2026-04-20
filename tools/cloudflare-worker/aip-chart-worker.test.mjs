import assert from 'node:assert/strict';
import {
  extractDfsLinksFromAipHtml,
  extractChartCandidateFromDfsHtml
} from './aip-chart-worker.js';

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test('extracts DFS link from aip.aero HTML', () => {
  const html = `
    <html>
      <a href="https://aip.dfs.de/BasicVFR/2026APR02/chapter/abc123.html">Chart</a>
    </html>
  `;
  const out = extractDfsLinksFromAipHtml(html);
  assert.equal(out[0], 'https://aip.dfs.de/BasicVFR/2026APR02/chapter/abc123.html');
});

test('extracts multiple DFS links from aip.aero HTML', () => {
  const html = `
    <html>
      <a href="https://aip.dfs.de/BasicVFR/2026APR02/chapter/a1.html">A</a>
      <a href="https://aip.dfs.de/BasicVFR/2026APR02/chapter/a2.html">B</a>
    </html>
  `;
  const out = extractDfsLinksFromAipHtml(html);
  assert.equal(out.length, 2);
});

test('extracts PDF candidate from DFS HTML', () => {
  const html = `
    <html>
      <img src="/assets/logo.webp">
      <a href="https://secais.dfs.de/charts/EDTW_vfr_chart.pdf">Download</a>
    </html>
  `;
  const out = extractChartCandidateFromDfsHtml(html, 'https://aip.dfs.de/BasicVFR/2026APR02/chapter/abc123.html');
  assert.equal(out?.chartKind, 'pdf');
  assert.equal(out?.chartUrl, 'https://secais.dfs.de/charts/EDTW_vfr_chart.pdf');
});

test('extracts image candidate from relative source URL', () => {
  const html = `
    <html>
      <img src="/render/vfr/edtw-approach-chart.png">
      <img src="/assets/logo.png">
    </html>
  `;
  const out = extractChartCandidateFromDfsHtml(html, 'https://aip.dfs.de/BasicVFR/2026APR02/chapter/abc123.html');
  assert.equal(out?.chartKind, 'image');
  assert.equal(out?.chartUrl, 'https://aip.dfs.de/render/vfr/edtw-approach-chart.png');
});

test('returns null when only logo/icon assets exist', () => {
  const html = `
    <html>
      <img src="/img/logo.png">
      <img src="/img/favicon-32x32.png">
    </html>
  `;
  const out = extractChartCandidateFromDfsHtml(html, 'https://aip.dfs.de/BasicVFR/2026APR02/chapter/abc123.html');
  assert.equal(out, null);
});

test('returns null for language flag assets in /img path', () => {
  const html = `
    <html>
      <img src="https://aip.dfs.de/BasicVFR/img/de.png">
      <img src="https://aip.dfs.de/BasicVFR/img/en.png">
    </html>
  `;
  const out = extractChartCandidateFromDfsHtml(html, 'https://aip.dfs.de/BasicVFR/2026APR02/chapter/abc123.html');
  assert.equal(out, null);
});

console.log('All fixture tests passed.');
