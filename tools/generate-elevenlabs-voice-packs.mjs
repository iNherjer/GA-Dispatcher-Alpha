#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ROOT = process.cwd();
const VOICES_ROOT = path.join(ROOT, 'audio-warnings', 'voices');
const CONFIG_PATH = path.join(ROOT, 'tools', 'elevenlabs-voices.config.json');
const API_BASE = 'https://api.elevenlabs.io/v1';
const execFileAsync = promisify(execFile);

const CLIPS = [
  { key: 'aw-achtung', text: 'Achtung' },
  { key: 'aw-in', text: 'in' },
  { key: 'aw-ctr', text: 'Kontrollzone' },
  { key: 'aw-charlie', text: 'Luftraum Charlie' },
  { key: 'aw-delta', text: 'Luftraum Delta' },
  { key: 'aw-rmz', text: 'Radio Mandatory Zone' },
  { key: 'aw-tmz', text: 'Transponder Mandatory Zone' },
  { key: 'aw-edr', text: 'Flugbeschränkungsgebiet' },
  { key: 'aw-para', text: 'Fallschirmsprunggebiet' },
  { key: 'aw-1min', text: 'einer Minute' },
  { key: 'aw-2min', text: 'zwei Minuten' },
  { key: 'aw-3min', text: 'drei Minuten' },
  { key: 'aw-4min', text: 'vier Minuten' },
  { key: 'aw-5min', text: 'fünf Minuten' },
  { key: 'aw-6min', text: 'sechs Minuten' },
  { key: 'aw-7min', text: 'sieben Minuten' },
  { key: 'aw-8min', text: 'acht Minuten' },
  { key: 'aw-9min', text: 'neun Minuten' },
  { key: 'aw-10min', text: 'zehn Minuten' },
  { key: 'aw-freq', text: 'Frequenz' },
  { key: 'aw-sqwk', text: 'Squawk' },
  { key: 'aw-komma', text: 'Das Trennzeichen kommt jetzt.\n\nKomma.', trim: 'tail', tailSec: 0.72 },
  { key: 'aw-d0', text: 'Die Ziffer kommt jetzt.\n\nNull.', trim: 'tail', tailSec: 0.72 },
  { key: 'aw-d1', text: 'Die Ziffer kommt jetzt.\n\nEins.', trim: 'tail', tailSec: 0.72 },
  { key: 'aw-d2', text: 'Die Ziffer kommt jetzt.\n\nZwo.', trim: 'tail', tailSec: 0.78 },
  { key: 'aw-d3', text: 'Die Ziffer kommt jetzt.\n\nDrei.', trim: 'tail', tailSec: 0.76 },
  { key: 'aw-d4', text: 'Die Ziffer kommt jetzt.\n\nVier.', trim: 'tail', tailSec: 0.76 },
  { key: 'aw-d5', text: 'Die Ziffer kommt jetzt.\n\nFünf.', trim: 'tail', tailSec: 0.82 },
  { key: 'aw-d6', text: 'Die Ziffer kommt jetzt.\n\nSechs.', trim: 'tail', tailSec: 0.82 },
  { key: 'aw-d7', text: 'Die Ziffer kommt jetzt.\n\nSieben.', trim: 'tail', tailSec: 0.84 },
  { key: 'aw-d8', text: 'Die Ziffer kommt jetzt.\n\nAcht.', trim: 'tail', tailSec: 0.76 },
  { key: 'aw-d9', text: 'Die Ziffer kommt jetzt.\n\nNeun.', trim: 'tail', tailSec: 0.78 },
  { key: 'aw-zwo', text: 'Die Ziffer kommt jetzt.\n\nZwo.', trim: 'tail', tailSec: 0.78 },
  { key: 'aw-wp-erreicht', text: 'Wegpunkt erreicht' },
  { key: 'aw-neuer-kurs', text: 'Neuer Steuerkurs' },
  { key: 'aw-grad', text: 'Die Einheit lautet jetzt.\n\nGrad.', trim: 'tail', tailSec: 0.76 },
  { key: 'aw-fuer', text: 'Das Wort lautet jetzt.\n\nFür.', trim: 'tail', tailSec: 0.74 },
  { key: 'aw-meilen', text: 'Die Einheit lautet jetzt.\n\nMeilen.', trim: 'tail', tailSec: 0.86 },
  { key: 'demo', text: 'Demo. Neuer Steuerkurs null zwo fünf Grad. In einer Minute. Frequenz eins zwo drei Komma vier fünf zwo.' }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { only: null, force: false, clips: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--only') out.only = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--clips') out.clips = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--force') out.force = true;
  }
  return out;
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function fetchVoices(apiKey) {
  // /voices braucht voices_read-Permission — bei reinen TTS-Keys nicht verfügbar.
  // Dann einfach leeres Array zurückgeben; resolveVoiceId() greift auf voiceId in der Config zurück.
  const r = await fetch(`${API_BASE}/voices`, { headers: { 'xi-api-key': apiKey } });
  if (!r.ok) {
    process.stderr.write(`[info] /voices nicht verfügbar (HTTP ${r.status}) — voiceId aus Config wird verwendet.\n`);
    return [];
  }
  const data = await r.json();
  return Array.isArray(data.voices) ? data.voices : [];
}

function resolveVoiceId(pack, voices) {
  if (pack.voiceId) return pack.voiceId;
  const byName = voices.find(v => (v.name || '').toLowerCase() === (pack.voiceName || '').toLowerCase());
  if (byName?.voice_id) return byName.voice_id;
  return null;
}

async function synthesize(apiKey, voiceId, modelId, outputFormat, voiceSettings, text) {
  const r = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      output_format: outputFormat,
      voice_settings: voiceSettings
    })
  });
  if (!r.ok) {
    const err = await r.text().catch(() => '');
    throw new Error(`TTS HTTP ${r.status}: ${err.slice(0, 220)}`);
  }
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
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

async function isValidAudio(file) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      file
    ], { maxBuffer: 1024 * 1024 * 4 });
    const duration = Number(String(stdout).trim());
    return Number.isFinite(duration) && duration >= 0.12;
  } catch {
    return false;
  }
}

async function getAudioDuration(file) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file
  ], { maxBuffer: 1024 * 1024 * 4 });
  const duration = Number(String(stdout).trim());
  if (!Number.isFinite(duration)) throw new Error(`Ungueltige Audio-Dauer fuer ${file}`);
  return duration;
}

async function trimToLastChunk(inputFile, outputFile) {
  const inputDuration = await getAudioDuration(inputFile);
  const detectorArgs = [
    '-hide_banner', '-nostats', '-i', inputFile,
    '-af', 'silencedetect=noise=-35dB:d=0.14',
    '-f', 'null', '-'
  ];
  const { stderr } = await execFileAsync('ffmpeg', detectorArgs, { maxBuffer: 1024 * 1024 * 16 });
  const matches = [...stderr.matchAll(/silence_end:\s*([0-9.]+)/g)].map(m => Number(m[1]));
  const eligibleEnds = matches.filter(t => Number.isFinite(t) && t < (inputDuration - 0.18));
  if (!eligibleEnds.length) {
    await fs.copyFile(inputFile, outputFile);
    return;
  }
  const lastSilenceEnd = eligibleEnds[eligibleEnds.length - 1];
  const startAt = Math.max(0, lastSilenceEnd - 0.04);
  const tempOut = `${outputFile}.tmp.mp3`;
  const trimArgs = [
    '-y',
    '-hide_banner',
    '-ss', String(startAt),
    '-i', inputFile,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ac', '1',
    '-ar', '44100',
    '-af', 'atrim=start=0,asetpts=N/SR/TB',
    tempOut
  ];
  await execFileAsync('ffmpeg', trimArgs, { maxBuffer: 1024 * 1024 * 16 });

  if (await isValidAudio(tempOut)) {
    await fs.rename(tempOut, outputFile);
    return;
  }

  const trimWithSilenceArgs = [
    '-y',
    '-hide_banner',
    '-ss', String(startAt),
    '-i', inputFile,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ac', '1',
    '-ar', '44100',
    '-af', 'silenceremove=start_periods=1:start_silence=0.03:start_threshold=-40dB:stop_periods=-1:stop_duration=0.08:stop_threshold=-42dB',
    tempOut
  ];
  await execFileAsync('ffmpeg', trimWithSilenceArgs, { maxBuffer: 1024 * 1024 * 16 });

  if (await isValidAudio(tempOut)) {
    await fs.rename(tempOut, outputFile);
    return;
  }

  await fs.rm(tempOut, { force: true });
  await fs.copyFile(inputFile, outputFile);
}

async function trimToTail(inputFile, outputFile, tailSec) {
  const inputDuration = await getAudioDuration(inputFile);
  const startAt = Math.max(0, inputDuration - Math.max(0.35, tailSec || 0.75));
  const tempOut = `${outputFile}.tmp.mp3`;
  const args = [
    '-y',
    '-hide_banner',
    '-ss', String(startAt),
    '-i', inputFile,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ac', '1',
    '-ar', '44100',
    '-af', 'silenceremove=start_periods=1:start_silence=0.02:start_threshold=-42dB:stop_periods=-1:stop_duration=0.05:stop_threshold=-42dB',
    tempOut
  ];
  await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 16 });

  if (await isValidAudio(tempOut)) {
    await fs.rename(tempOut, outputFile);
    return;
  }

  await fs.rm(tempOut, { force: true });
  await fs.copyFile(inputFile, outputFile);
}

async function buildPack(apiKey, pack, cfg, force, clipFilter) {
  const dir = path.join(VOICES_ROOT, pack.id);
  await ensureDir(dir);

  for (const clip of CLIPS) {
    const { key, text, trim, tailSec } = clip;
    if (clipFilter?.length && !clipFilter.includes(key)) continue;
    const file = path.join(dir, `${key}.mp3`);
    if (!force && await exists(file)) continue;
    const audio = await synthesize(
      apiKey,
      pack.voiceIdResolved,
      cfg.modelId,
      cfg.outputFormat,
      cfg.voiceSettings,
      text
    );
    if (trim === 'last') {
      const tempFile = path.join(os.tmpdir(), `${pack.id}-${key}-${Date.now()}.mp3`);
      await fs.writeFile(tempFile, audio);
      try {
        await trimToLastChunk(tempFile, file);
      } finally {
        await fs.rm(tempFile, { force: true });
      }
    } else if (trim === 'tail') {
      const tempFile = path.join(os.tmpdir(), `${pack.id}-${key}-${Date.now()}.mp3`);
      await fs.writeFile(tempFile, audio);
      try {
        await trimToTail(tempFile, file, tailSec);
      } finally {
        await fs.rm(tempFile, { force: true });
      }
    } else {
      await fs.writeFile(file, audio);
    }
    process.stdout.write(`  ${pack.id}: ${key}.mp3\n`);
    await new Promise(r => setTimeout(r, 120));
  }
}

async function writeCatalog(allPacks) {
  const catalog = {
    generatedAt: new Date().toISOString(),
    packs: allPacks.map(p => ({ id: p.id, label: p.label, emoji: p.emoji || '🎙️' }))
  };
  const file = path.join(VOICES_ROOT, 'catalog.json');
  await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY fehlt. Beispiel: ELEVENLABS_API_KEY=... node tools/generate-elevenlabs-voice-packs.mjs --only matilda,hannah,liam --force');
  }
  const args = parseArgs();
  const cfg = await readJson(CONFIG_PATH);
  const voices = await fetchVoices(apiKey);
  const packsAll = Array.isArray(cfg.packs) ? cfg.packs : [];
  const selected = args.only
    ? packsAll.filter(p => args.only.includes(p.id))
    : packsAll;

  if (!selected.length) throw new Error('Keine passenden Packs gefunden (Parameter --only pruefen).');

  for (const pack of selected) {
    const voiceId = resolveVoiceId(pack, voices);
    if (!voiceId) {
      process.stderr.write(`[skip] ${pack.id}: Voice "${pack.voiceName || ''}" nicht gefunden.\n`);
      continue;
    }
    pack.voiceIdResolved = voiceId;
    process.stdout.write(`[start] ${pack.id} (${pack.label})\n`);
    await buildPack(apiKey, pack, cfg, args.force, args.clips);
    process.stdout.write(`[done]  ${pack.id}\n`);
  }

  await ensureDir(VOICES_ROOT);
  await writeCatalog(packsAll);
  process.stdout.write('[ok] catalog.json aktualisiert.\n');
}

main().catch(err => {
  console.error('[error]', err.message || err);
  process.exit(1);
});
