import fs from 'node:fs';
import path from 'node:path';

const inputDir = '/Users/jofaist/Library/CloudStorage/OneDrive-Persönlich/Simconnect jitter test';
const outputDir = '/Users/jofaist/Desktop/GA dispatcher alpha/analysis/simconnect-jitter-graphs';

const tests = [
  {
    id: '01',
    file: '01-boden-still-visual-minimal.csv',
    label: '01 Boden still',
    color: '#2563eb',
    note: 'VISUAL_FRAME minimal, DRSM aus'
  },
  {
    id: '02',
    file: '02-flug-aktiv-visual-minimal.csv',
    label: '02 Flug aktiv minimal',
    color: '#059669',
    note: 'VISUAL_FRAME minimal, DRSM aus'
  },
  {
    id: '03',
    file: '03-flug-aktiv-visual-motion.csv',
    label: '03 Flug aktiv motion',
    color: '#7c3aed',
    note: 'VISUAL_FRAME Motion-SimVars, DRSM aus'
  },
  {
    id: '04',
    file: '04-flug-aktiv-sim-motion.csv',
    label: '04 SIM_FRAME motion',
    color: '#ea580c',
    note: 'SIM_FRAME Motion-SimVars, DRSM aus'
  },
  {
    id: '05',
    file: '05-mit-drsm-visual-motion.csv',
    label: '05 Mit DRSM',
    color: '#dc2626',
    note: 'VISUAL_FRAME Motion-SimVars, DRSM aktiv'
  }
];

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function readTest(test) {
  const text = fs.readFileSync(path.join(inputDir, test.file), 'utf8').trim();
  const lines = text.split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return {
      t: Number(cells[0]) / 1000,
      dt: Number(cells[1]),
      values: cells.slice(2).map(Number)
    };
  }).filter((row) => Number.isFinite(row.t) && Number.isFinite(row.dt));
  return { ...test, header, rows };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function stats(rows) {
  const values = rows.map((row) => row.dt);
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + ((b - avg) ** 2), 0) / values.length);
  return {
    n: values.length,
    duration: rows.at(-1)?.t ?? 0,
    hz: 1000 / avg,
    avg,
    sd,
    min: sorted[0],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    p999: percentile(sorted, 99.9),
    max: sorted.at(-1),
    gt20: values.filter((v) => v > 20).length,
    gt25: values.filter((v) => v > 25).length,
    gt33: values.filter((v) => v > 33.3).length,
    gt50: values.filter((v) => v > 50).length,
    gt100: values.filter((v) => v > 100).length
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function lineChart({ title, subtitle, datasets, width = 1280, height = 720, yMax = 60, file }) {
  const margin = { top: 74, right: 42, bottom: 76, left: 78 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const xMax = Math.max(...datasets.flatMap((d) => d.points.map((p) => p.x)), 120);
  const x = (v) => margin.left + (v / xMax) * innerW;
  const y = (v) => margin.top + (1 - Math.min(v, yMax) / yMax) * innerH;
  const ticksX = [0, 20, 40, 60, 80, 100, 120].filter((v) => v <= xMax + 1);
  const ticksY = [0, 10, 20, 30, 40, 50, 60].filter((v) => v <= yMax);
  const grid = [
    ...ticksY.map((v) => `<line x1="${margin.left}" y1="${y(v)}" x2="${width - margin.right}" y2="${y(v)}" stroke="#e5e7eb"/>`),
    ...ticksX.map((v) => `<line x1="${x(v)}" y1="${margin.top}" x2="${x(v)}" y2="${height - margin.bottom}" stroke="#f1f5f9"/>`)
  ].join('\n');
  const axes = `
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#111827"/>
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#111827"/>
    ${ticksX.map((v) => `<text x="${x(v)}" y="${height - margin.bottom + 28}" text-anchor="middle" class="axis">${v}s</text>`).join('\n')}
    ${ticksY.map((v) => `<text x="${margin.left - 14}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join('\n')}
    <text x="${width / 2}" y="${height - 22}" text-anchor="middle" class="axis-label">Zeit im Test</text>
    <text x="24" y="${height / 2}" text-anchor="middle" transform="rotate(-90 24 ${height / 2})" class="axis-label">Callback-Abstand dt_ms</text>
  `;
  const lines = datasets.map((dataset) => {
    const d = dataset.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.x).toFixed(2)} ${y(p.y).toFixed(2)}`).join(' ');
    const spikes = dataset.points
      .filter((p) => p.rawY > yMax)
      .map((p) => `<circle cx="${x(p.x)}" cy="${y(yMax)}" r="4" fill="${dataset.color}" opacity="0.75"><title>${dataset.label}: ${fmt(p.rawY)} ms bei ${fmt(p.x)}s</title></circle>`)
      .join('\n');
    return `<path d="${d}" fill="none" stroke="${dataset.color}" stroke-width="2" opacity="0.88"/>\n${spikes}`;
  }).join('\n');
  const legend = datasets.map((dataset, i) => {
    const lx = margin.left + i * 230;
    const ly = height - 48;
    return `<g><rect x="${lx}" y="${ly - 12}" width="16" height="16" fill="${dataset.color}"/><text x="${lx + 24}" y="${ly + 1}" class="legend">${escapeHtml(dataset.label)}</text></g>`;
  }).join('\n');
  const svg = svgShell(width, height, title, subtitle, `${grid}\n${axes}\n${lines}\n${legend}`);
  fs.writeFileSync(path.join(outputDir, file), svg);
}

function barChart({ title, subtitle, data, width = 1280, height = 720, file }) {
  const margin = { top: 92, right: 40, bottom: 130, left: 82 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const yMax = Math.max(...data.map((d) => d.value)) * 1.18;
  const y = (v) => margin.top + (1 - v / yMax) * innerH;
  const barGap = 18;
  const barW = (innerW - barGap * (data.length - 1)) / data.length;
  const ticksY = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45].filter((v) => v <= yMax);
  const grid = ticksY.map((v) => `<line x1="${margin.left}" y1="${y(v)}" x2="${width - margin.right}" y2="${y(v)}" stroke="#e5e7eb"/>`).join('\n');
  const bars = data.map((d, i) => {
    const bx = margin.left + i * (barW + barGap);
    const by = y(d.value);
    return `
      <rect x="${bx}" y="${by}" width="${barW}" height="${height - margin.bottom - by}" fill="${d.color}" rx="4"/>
      <text x="${bx + barW / 2}" y="${by - 10}" text-anchor="middle" class="value">${fmt(d.value)}</text>
      <text x="${bx + barW / 2}" y="${height - margin.bottom + 28}" text-anchor="middle" class="axis">${escapeHtml(d.label)}</text>
      <text x="${bx + barW / 2}" y="${height - margin.bottom + 50}" text-anchor="middle" class="small">${escapeHtml(d.sub)}</text>
    `;
  }).join('\n');
  const axes = `
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#111827"/>
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#111827"/>
    ${ticksY.map((v) => `<text x="${margin.left - 14}" y="${y(v) + 5}" text-anchor="end" class="axis">${v}</text>`).join('\n')}
    <text x="24" y="${height / 2}" text-anchor="middle" transform="rotate(-90 24 ${height / 2})" class="axis-label">Millisekunden</text>
  `;
  fs.writeFileSync(path.join(outputDir, file), svgShell(width, height, title, subtitle, `${grid}\n${axes}\n${bars}`));
}

function spikeLollipop({ title, subtitle, datasets, width = 1280, height = 720, file }) {
  const margin = { top: 86, right: 50, bottom: 90, left: 190 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const rowH = innerH / datasets.length;
  const xMax = Math.max(...datasets.flatMap((d) => d.spikes.map((s) => s.dt)), 50);
  const x = (v) => margin.left + (v / xMax) * innerW;
  const ticks = [0, 25, 50, 75, 100, 125, 150].filter((v) => v <= xMax + 10);
  const grid = ticks.map((v) => `<line x1="${x(v)}" y1="${margin.top}" x2="${x(v)}" y2="${height - margin.bottom}" stroke="#e5e7eb"/>`).join('\n');
  const rows = datasets.map((d, i) => {
    const cy = margin.top + rowH * i + rowH / 2;
    return `
      <text x="${margin.left - 18}" y="${cy + 5}" text-anchor="end" class="legend">${escapeHtml(d.label)}</text>
      <line x1="${margin.left}" y1="${cy}" x2="${width - margin.right}" y2="${cy}" stroke="#e5e7eb"/>
      ${d.spikes.map((s) => `
        <line x1="${margin.left}" y1="${cy}" x2="${x(s.dt)}" y2="${cy}" stroke="${d.color}" stroke-width="2" opacity="0.55"/>
        <circle cx="${x(s.dt)}" cy="${cy}" r="${Math.max(4, Math.min(11, s.dt / 10))}" fill="${d.color}" opacity="0.82">
          <title>${d.label}: ${fmt(s.dt)} ms bei ${fmt(s.t)}s</title>
        </circle>
      `).join('\n')}
    `;
  }).join('\n');
  const axes = `
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#111827"/>
    ${ticks.map((v) => `<text x="${x(v)}" y="${height - margin.bottom + 30}" text-anchor="middle" class="axis">${v} ms</text>`).join('\n')}
    <text x="${width / 2}" y="${height - 28}" text-anchor="middle" class="axis-label">Ausreißer über 25 ms</text>
  `;
  fs.writeFileSync(path.join(outputDir, file), svgShell(width, height, title, subtitle, `${grid}\n${rows}\n${axes}`));
}

function svgShell(width, height, title, subtitle, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font: 700 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #0f172a; }
    .subtitle { font: 400 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #475569; }
    .axis { font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #334155; }
    .small { font: 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #64748b; }
    .axis-label { font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #334155; }
    .legend { font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #1e293b; }
    .value { font: 700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #111827; }
  </style>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="42" y="42" class="title">${escapeHtml(title)}</text>
  <text x="42" y="68" class="subtitle">${escapeHtml(subtitle)}</text>
  ${body}
</svg>`;
}

function decimate(rows, maxPoints = 1300) {
  if (rows.length <= maxPoints) return rows.map((row) => ({ x: row.t, y: row.dt, rawY: row.dt }));
  const bucketSize = Math.ceil(rows.length / maxPoints);
  const points = [];
  for (let i = 0; i < rows.length; i += bucketSize) {
    const bucket = rows.slice(i, i + bucketSize);
    const max = bucket.reduce((a, b) => b.dt > a.dt ? b : a, bucket[0]);
    points.push({ x: max.t, y: max.dt, rawY: max.dt });
  }
  return points;
}

function htmlDashboard(all) {
  const cards = all.map((d) => {
    const s = d.stats;
    return `
      <tr>
        <td><span class="swatch" style="background:${d.color}"></span>${escapeHtml(d.label)}</td>
        <td>${fmt(s.avg)}</td>
        <td>${fmt(s.hz)}</td>
        <td>${fmt(s.p95)}</td>
        <td>${fmt(s.p99)}</td>
        <td>${fmt(s.max)}</td>
        <td>${s.gt25}</td>
        <td>${s.gt50}</td>
      </tr>
    `;
  }).join('\n');
  const figs = [
    ['01-time-series-all.svg', 'Callback-Abstände über Zeit'],
    ['02-p99-comparison.svg', 'p99-Vergleich'],
    ['03-spike-counts.svg', 'Spike-Zählung'],
    ['04-spike-events.svg', 'Einzelne Ausreißer über 25 ms']
  ].map(([file, caption]) => `
    <figure>
      <img src="${file}" alt="${escapeHtml(caption)}">
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>
  `).join('\n');
  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>SimConnect Jitter Auswertung</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    main { max-width: 1220px; margin: 0 auto; padding: 34px 24px 54px; }
    h1 { margin: 0 0 8px; font-size: 34px; }
    p { color: #475569; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; }
    th, td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th { color: #334155; background: #f1f5f9; font-size: 13px; }
    .swatch { display: inline-block; width: 12px; height: 12px; margin-right: 8px; vertical-align: -1px; }
    figure { margin: 28px 0; padding: 12px; background: white; border: 1px solid #e2e8f0; }
    img { width: 100%; height: auto; display: block; }
    figcaption { padding: 10px 4px 2px; color: #475569; font-size: 14px; }
    .note { background: #fff7ed; border: 1px solid #fed7aa; padding: 14px 16px; margin: 18px 0 22px; color: #7c2d12; }
  </style>
</head>
<body>
<main>
  <h1>SimConnect Jitter Auswertung</h1>
  <p>Auswertung der fünf Testläufe. Fokus: Callback-Abstände, p99 und Ausreißer, weil einzelne Spikes für Motion-Ruckeln wichtiger sein können als der Durchschnitt.</p>
  <div class="note">Kurzbefund: Ohne DRSM liegt SimConnect meist bei ca. 115-117 Hz. Mit DRSM sinkt der Takt auf ca. 106 Hz und die Ausreißer nehmen zu.</div>
  <table>
    <thead><tr><th>Test</th><th>avg ms</th><th>Hz</th><th>p95</th><th>p99</th><th>max</th><th>&gt;25 ms</th><th>&gt;50 ms</th></tr></thead>
    <tbody>${cards}</tbody>
  </table>
  ${figs}
</main>
</body>
</html>`;
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
}

const all = tests.map(readTest).map((test) => ({ ...test, stats: stats(test.rows) }));

lineChart({
  title: 'Callback-Abstände über Zeit',
  subtitle: 'dt_ms, auf 60 ms gedeckelt; Punkte am oberen Rand sind größere Ausreißer',
  datasets: all.map((d) => ({ label: d.label, color: d.color, points: decimate(d.rows) })),
  file: '01-time-series-all.svg'
});

barChart({
  title: 'p99 Callback-Abstand',
  subtitle: '99 Prozent der Callbacks liegen unter diesem Wert',
  data: all.map((d) => ({ label: d.id, sub: d.label.replace(/^\d+\s*/, ''), color: d.color, value: d.stats.p99 })),
  file: '02-p99-comparison.svg'
});

barChart({
  title: 'Spikes über 25 ms',
  subtitle: 'Anzahl der Callback-Abstände über 25 ms im 120-Sekunden-Lauf',
  data: all.map((d) => ({ label: d.id, sub: d.label.replace(/^\d+\s*/, ''), color: d.color, value: d.stats.gt25 })),
  file: '03-spike-counts.svg'
});

spikeLollipop({
  title: 'Einzelne Ausreißer über 25 ms',
  subtitle: 'Jeder Kreis ist ein Callback-Abstand über 25 ms; längere Linien bedeuten stärkere Hänger',
  datasets: all.map((d) => ({
    label: d.label,
    color: d.color,
    spikes: d.rows.filter((row) => row.dt > 25).map((row) => ({ t: row.t, dt: row.dt }))
  })),
  file: '04-spike-events.svg'
});

htmlDashboard(all);

const summary = all.map((d) => ({
  test: d.label,
  avg_ms: Number(d.stats.avg.toFixed(3)),
  hz: Number(d.stats.hz.toFixed(2)),
  p95_ms: Number(d.stats.p95.toFixed(3)),
  p99_ms: Number(d.stats.p99.toFixed(3)),
  max_ms: Number(d.stats.max.toFixed(3)),
  spikes_gt25: d.stats.gt25,
  spikes_gt50: d.stats.gt50,
  spikes_gt100: d.stats.gt100
}));
fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

console.log(`Wrote graphs to ${outputDir}`);
