#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const VOICES_ROOT = path.join(ROOT, 'audio-warnings', 'voices');
const CATALOG_PATH = path.join(VOICES_ROOT, 'catalog.json');

const EN_CLIPS = [
  { key: 'aw-achtung', text: 'Caution' },
  { key: 'aw-in', text: 'in' },
  { key: 'aw-ctr', text: 'control zone' },
  { key: 'aw-charlie', text: 'airspace Charlie' },
  { key: 'aw-delta', text: 'airspace Delta' },
  { key: 'aw-rmz', text: 'radio mandatory zone' },
  { key: 'aw-tmz', text: 'transponder mandatory zone' },
  { key: 'aw-edr', text: 'restricted area' },
  { key: 'aw-para', text: 'parachute area' },
  { key: 'aw-1min', text: 'one minute' },
  { key: 'aw-2min', text: 'two minutes' },
  { key: 'aw-3min', text: 'three minutes' },
  { key: 'aw-4min', text: 'four minutes' },
  { key: 'aw-5min', text: 'five minutes' },
  { key: 'aw-6min', text: 'six minutes' },
  { key: 'aw-7min', text: 'seven minutes' },
  { key: 'aw-8min', text: 'eight minutes' },
  { key: 'aw-9min', text: 'nine minutes' },
  { key: 'aw-10min', text: 'ten minutes' },
  { key: 'aw-freq', text: 'frequency' },
  { key: 'aw-sqwk', text: 'squawk' },
  { key: 'aw-komma', text: 'decimal' },
  { key: 'aw-d0', text: 'zero' },
  { key: 'aw-d1', text: 'one' },
  { key: 'aw-d2', text: 'two' },
  { key: 'aw-d3', text: 'three' },
  { key: 'aw-d4', text: 'four' },
  { key: 'aw-d5', text: 'five' },
  { key: 'aw-d6', text: 'six' },
  { key: 'aw-d7', text: 'seven' },
  { key: 'aw-d8', text: 'eight' },
  { key: 'aw-d9', text: 'nine' },
  { key: 'aw-zwo', text: 'two' },
  { key: 'aw-wp-erreicht', text: 'waypoint reached' },
  { key: 'aw-neuer-kurs', text: 'new heading' },
  { key: 'aw-grad', text: 'degrees' },
  { key: 'aw-fuer', text: 'for' },
  { key: 'aw-meilen', text: 'miles' },
  { key: 'demo', text: 'Demo. New heading zero two five degrees. In one minute. Frequency one two three decimal four five two.' }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    packId: 'ava-en',
    voice: 'Ava (Premium)',
    rate: 182,
    force: false,
    clips: null,
    label: 'Ava (EN)',
    emoji: '🇬🇧',
    language: 'en'
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--pack') out.packId = String(args[++i] || out.packId);
    else if (a === '--voice') out.voice = String(args[++i] || out.voice);
    else if (a === '--rate') out.rate = Number(args[++i] || out.rate);
    else if (a === '--label') out.label = String(args[++i] || out.label);
    else if (a === '--emoji') out.emoji = String(args[++i] || out.emoji);
    else if (a === '--language') out.language = String(args[++i] || out.language);
    else if (a === '--clips') out.clips = String(args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--force') out.force = true;
  }
  return out;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function renderClip({ voice, rate, text, outFile }) {
  const tmpAiff = path.join(os.tmpdir(), `macos-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.aiff`);
  try {
    await execFileAsync('say', ['-v', voice, '-r', String(rate), '-o', tmpAiff, '--', text], { maxBuffer: 1024 * 1024 * 8 });
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', tmpAiff,
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ac', '1',
      '-ar', '44100',
      outFile
    ], { maxBuffer: 1024 * 1024 * 16 });
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outFile
    ], { maxBuffer: 1024 * 1024 * 4 });
    const dur = Number(String(stdout).trim());
    if (!Number.isFinite(dur) || dur < 0.12) {
      throw new Error(`Ungültiger Audio-Output für ${path.basename(outFile)} (Dauer: ${String(stdout).trim() || 'n/a'})`);
    }
  } finally {
    await fs.rm(tmpAiff, { force: true });
  }
}

async function updateCatalog(entry) {
  let current = { packs: [] };
  if (await exists(CATALOG_PATH)) {
    try {
      current = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
    } catch {
      current = { packs: [] };
    }
  }
  const packs = Array.isArray(current.packs) ? current.packs.filter(Boolean) : [];
  const idx = packs.findIndex(p => p && p.id === entry.id);
  if (idx >= 0) packs[idx] = { ...packs[idx], ...entry };
  else packs.push(entry);
  const next = {
    generatedAt: new Date().toISOString(),
    packs
  };
  await ensureDir(VOICES_ROOT);
  await fs.writeFile(CATALOG_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

async function main() {
  const opts = parseArgs();
  if (!Number.isFinite(opts.rate) || opts.rate < 80 || opts.rate > 320) {
    throw new Error('Ungültige Rate. Erlaubt: 80-320');
  }
  const packDir = path.join(VOICES_ROOT, opts.packId);
  await ensureDir(packDir);
  const clipFilter = new Set(opts.clips || []);

  for (const clip of EN_CLIPS) {
    if (clipFilter.size && !clipFilter.has(clip.key)) continue;
    const outFile = path.join(packDir, `${clip.key}.mp3`);
    if (!opts.force && await exists(outFile)) continue;
    await renderClip({
      voice: opts.voice,
      rate: opts.rate,
      text: clip.text,
      outFile
    });
    process.stdout.write(`  ${opts.packId}: ${clip.key}.mp3\n`);
  }

  await updateCatalog({
    id: opts.packId,
    label: opts.label,
    emoji: opts.emoji,
    language: opts.language
  });
  process.stdout.write(`[ok] ${opts.packId} gerendert und catalog.json aktualisiert.\n`);
}

main().catch(err => {
  console.error('[error]', err.message || err);
  process.exit(1);
});
