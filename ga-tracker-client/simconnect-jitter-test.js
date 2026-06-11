const fs = require('fs');
const path = require('path');
const {
  open,
  Protocol,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod
} = require('node-simconnect');

const APP_NAME = 'GA-SimConnect-Jitter-Test';
const DEF_ID = 8801;
const REQ_ID = 8801;

const PERIODS = {
  visual: SimConnectPeriod.VISUAL_FRAME,
  sim: SimConnectPeriod.SIM_FRAME,
  second: SimConnectPeriod.SECOND
};

const MODES = {
  minimal: [
    ['PLANE BANK DEGREES', 'degrees']
  ],
  motion: [
    ['PLANE PITCH DEGREES', 'degrees'],
    ['PLANE BANK DEGREES', 'degrees'],
    ['PLANE HEADING DEGREES TRUE', 'degrees'],
    ['VELOCITY BODY X', 'feet per second'],
    ['VELOCITY BODY Y', 'feet per second'],
    ['VELOCITY BODY Z', 'feet per second'],
    ['ACCELERATION BODY X', 'feet per second squared'],
    ['ACCELERATION BODY Y', 'feet per second squared'],
    ['ACCELERATION BODY Z', 'feet per second squared'],
    ['ROTATION VELOCITY BODY X', 'radians per second'],
    ['ROTATION VELOCITY BODY Y', 'radians per second'],
    ['ROTATION VELOCITY BODY Z', 'radians per second']
  ]
};

function parseArgs(argv) {
  const out = {
    period: 'visual',
    mode: 'minimal',
    duration: 120,
    interval: 0,
    csv: 'auto',
    pause: 'auto'
  };

  for (const token of argv) {
    if (token === '--help' || token === '-h') {
      out.help = true;
      continue;
    }
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    const key = token.slice(2, eq === -1 ? undefined : eq).trim();
    const value = eq === -1 ? 'true' : token.slice(eq + 1).trim();
    if (key in out) out[key] = value;
  }

  out.period = String(out.period || '').toLowerCase();
  out.mode = String(out.mode || '').toLowerCase();
  out.duration = Math.max(5, Number(out.duration) || 120);
  out.interval = Math.max(0, Math.floor(Number(out.interval) || 0));
  out.pause = String(out.pause || 'auto').toLowerCase();
  return out;
}

function usage() {
  console.log('');
  console.log('GA SimConnect Jitter Test');
  console.log('');
  console.log('Usage:');
  console.log('  SimConnect-Jitter-Test.exe --period=visual --duration=120');
  console.log('  SimConnect-Jitter-Test.exe --period=sim --mode=motion --duration=180 --csv=jitter.csv');
  console.log('');
  console.log('Options:');
  console.log('  --period=visual|sim|second   SimConnect update period (default: visual)');
  console.log('  --mode=minimal|motion        SimVars to request (default: minimal)');
  console.log('  --duration=seconds           Measurement duration (default: 120)');
  console.log('  --interval=n                 SimConnect interval parameter (default: 0)');
  console.log('  --csv=file.csv|auto|off      Write raw callback intervals (default: auto)');
  console.log('  --pause=auto|on|off          Keep console open after finish (default: auto)');
  console.log('');
}

function outputDir() {
  if (process.pkg) return path.dirname(process.execPath);
  return __dirname;
}

function timestampForFile() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds())
  ].join('');
}

function shouldPause(args) {
  if (args.pause === 'on' || args.pause === 'true' || args.pause === '1') return true;
  if (args.pause === 'off' || args.pause === 'false' || args.pause === '0') return false;
  return process.platform === 'win32' && process.stdout.isTTY;
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdout.write('\nENTER druecken zum Schliessen ...');
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(samples) {
  if (!samples.length) return null;
  const sorted = samples.slice().sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const avg = sum / samples.length;
  const variance = samples.reduce((a, b) => a + ((b - avg) * (b - avg)), 0) / samples.length;
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  const spikeLimit = Math.max(33.3, p50 * 1.75);
  const spikes = samples.filter(v => v > spikeLimit).length;
  return {
    count: samples.length,
    hz: avg > 0 ? 1000 / avg : 0,
    avg,
    min,
    p50,
    p95,
    p99,
    max,
    stddev: Math.sqrt(variance),
    spikes,
    spikeLimit
  };
}

function formatStats(label, stats) {
  if (!stats) return `${label}: noch keine Samples`;
  return [
    `${label}:`,
    `${stats.count} callbacks`,
    `${stats.hz.toFixed(1)} Hz`,
    `avg ${stats.avg.toFixed(2)} ms`,
    `p50 ${stats.p50.toFixed(2)}`,
    `p95 ${stats.p95.toFixed(2)}`,
    `p99 ${stats.p99.toFixed(2)}`,
    `max ${stats.max.toFixed(2)}`,
    `jitter ${stats.stddev.toFixed(2)}`,
    `spikes>${stats.spikeLimit.toFixed(1)}ms: ${stats.spikes}`
  ].join(' | ');
}

function readAllFloat64(recv, count) {
  const values = [];
  const readFn = typeof recv.data.readFloat64 === 'function'
    ? () => recv.data.readFloat64()
    : (typeof recv.data.readDouble === 'function' ? () => recv.data.readDouble() : null);
  if (!readFn) return values;
  for (let i = 0; i < count; i++) {
    try { values.push(readFn()); } catch (_) { break; }
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  if (!PERIODS[args.period]) {
    console.log(`Unbekannter period-Wert: ${args.period}`);
    usage();
    process.exit(1);
  }
  if (!MODES[args.mode]) {
    console.log(`Unbekannter mode-Wert: ${args.mode}`);
    usage();
    process.exit(1);
  }

  let csvPath = '';
  const csvArg = String(args.csv || '').toLowerCase();
  if (csvArg && csvArg !== 'off' && csvArg !== 'false' && csvArg !== '0') {
    csvPath = csvArg === 'auto'
      ? path.join(outputDir(), `simconnect-jitter-${args.period}-${args.mode}-${timestampForFile()}.csv`)
      : path.resolve(process.cwd(), args.csv);
  }
  let csvStream = null;
  if (csvPath) {
    csvStream = fs.createWriteStream(csvPath, { flags: 'w' });
    csvStream.write('elapsed_ms,dt_ms');
    for (const [name] of MODES[args.mode]) csvStream.write(`,${JSON.stringify(name)}`);
    csvStream.write('\n');
  }

  console.log('=====================================');
  console.log(' GA SimConnect Jitter Test');
  console.log('=====================================');
  console.log(`Period   : ${args.period} (${PERIODS[args.period]})`);
  console.log(`Mode     : ${args.mode} (${MODES[args.mode].length} SimVars)`);
  console.log(`Duration : ${args.duration}s`);
  console.log(`Interval : ${args.interval}`);
  if (csvPath) console.log(`CSV      : ${csvPath}`);
  console.log('');
  console.log('Starte MSFS und lade einen Flug. Dieses Tool schreibt keine Daten in den Sim.');
  console.log('Verbinde mit SimConnect ...');

  const { recvOpen, handle } = await open(APP_NAME, Protocol.KittyHawk);
  console.log(`Verbunden: ${recvOpen.applicationName || 'MSFS'}`);

  handle.on('exception', (recv) => {
    console.log(`[SimConnect Exception] ${recv.exceptionName || recv.exception || 'unknown'} sendId=${recv.sendId}`);
  });
  handle.on('quit', () => {
    console.log('Simulator wurde beendet.');
    finish(0);
  });
  handle.on('close', () => {
    console.log('SimConnect-Verbindung geschlossen.');
    finish(0);
  });
  handle.on('error', (err) => {
    console.log(`SimConnect-Fehler: ${err?.message || err}`);
  });

  for (const [name, units] of MODES[args.mode]) {
    const hr = handle.addToDataDefinition(DEF_ID, name, units, SimConnectDataType.FLOAT64);
    if (typeof hr === 'number' && hr < 0) throw new Error(`SimVar nicht verfuegbar: ${name}`);
  }

  const all = [];
  let windowSamples = [];
  let lastNs = 0n;
  let startNs = 0n;
  let printedFirst = false;
  let finished = false;
  let reportTimer = null;
  let stopTimer = null;

  async function finish(code) {
    if (finished) return;
    finished = true;
    if (reportTimer) clearInterval(reportTimer);
    if (stopTimer) clearTimeout(stopTimer);
    const finalStats = summarize(all);
    console.log('');
    console.log(formatStats('FINAL', finalStats));
    if (finalStats) {
      if (finalStats.p99 > Math.max(40, finalStats.p50 * 2)) {
        console.log('Bewertung : deutlicher Callback-Jitter / Spikes sichtbar.');
      } else if (finalStats.stddev > finalStats.avg * 0.35) {
        console.log('Bewertung : durchschnittlicher Takt ok, aber unruhige Abstaende.');
      } else {
        console.log('Bewertung : SimConnect-Takt wirkt in diesem Lauf relativ stabil.');
      }
    }
    if (csvStream) {
      await new Promise((resolve) => csvStream.end(resolve));
      console.log(`CSV gespeichert: ${csvPath}`);
    }
    if (shouldPause(args)) await waitForEnter();
    setTimeout(() => process.exit(code), 150);
  }

  handle.on('simObjectData', (recv) => {
    if (recv.requestID !== REQ_ID || finished) return;
    const nowNs = process.hrtime.bigint();
    if (!startNs) startNs = nowNs;
    const values = readAllFloat64(recv, MODES[args.mode].length);
    if (lastNs) {
      const dtMs = Number(nowNs - lastNs) / 1e6;
      const elapsedMs = Number(nowNs - startNs) / 1e6;
      all.push(dtMs);
      windowSamples.push(dtMs);
      if (csvStream) {
        csvStream.write(`${elapsedMs.toFixed(3)},${dtMs.toFixed(3)}`);
        for (const value of values) csvStream.write(`,${Number.isFinite(value) ? value : ''}`);
        csvStream.write('\n');
      }
      if (!printedFirst) {
        printedFirst = true;
        console.log('Messung laeuft ...');
      }
    }
    lastNs = nowNs;
  });

  handle.requestDataOnSimObject(
    REQ_ID,
    DEF_ID,
    SimConnectConstants.OBJECT_ID_USER,
    PERIODS[args.period],
    0,
    0,
    args.interval,
    0
  );

  reportTimer = setInterval(() => {
    const stats = summarize(windowSamples);
    console.log(formatStats('5s', stats));
    windowSamples = [];
  }, 5000);

  stopTimer = setTimeout(() => finish(0), args.duration * 1000);

  process.on('SIGINT', () => finish(0));
  process.on('SIGTERM', () => finish(0));
}

main().catch(async (err) => {
  const args = parseArgs(process.argv.slice(2));
  console.log('');
  console.log(`ABBRUCH: ${err?.message || String(err)}`);
  if (shouldPause(args)) await waitForEnter();
  process.exit(1);
});
