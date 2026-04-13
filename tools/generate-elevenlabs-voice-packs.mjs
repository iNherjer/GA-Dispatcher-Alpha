#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const VOICES_ROOT = path.join(ROOT, 'audio-warnings', 'voices');
const CONFIG_PATH = path.join(ROOT, 'tools', 'elevenlabs-voices.config.json');
const API_BASE = 'https://api.elevenlabs.io/v1';

const CLIPS = [
  ['aw-achtung', 'Achtung'],
  ['aw-in', 'in'],
  ['aw-ctr', 'Kontrollzone'],
  ['aw-charlie', 'Luftraum Charlie'],
  ['aw-delta', 'Luftraum Delta'],
  ['aw-rmz', 'Radio Mandatory Zone'],
  ['aw-tmz', 'Transponder Mandatory Zone'],
  ['aw-edr', 'E D R'],
  ['aw-para', 'Fallschirmsprunggebiet'],
  ['aw-1min', 'eine Minute'],
  ['aw-2min', 'zwei Minuten'],
  ['aw-3min', 'drei Minuten'],
  ['aw-4min', 'vier Minuten'],
  ['aw-5min', 'fuenf Minuten'],
  ['aw-6min', 'sechs Minuten'],
  ['aw-7min', 'sieben Minuten'],
  ['aw-8min', 'acht Minuten'],
  ['aw-9min', 'neun Minuten'],
  ['aw-10min', 'zehn Minuten'],
  ['aw-freq', 'Frequenz'],
  ['aw-sqwk', 'Squawk'],
  ['aw-komma', 'Komma'],
  ['aw-d0', 'null'],
  ['aw-d1', 'eins'],
  ['aw-d2', 'zwo'],
  ['aw-d3', 'drei'],
  ['aw-d4', 'vier'],
  ['aw-d5', 'fuenf'],
  ['aw-d6', 'sechs'],
  ['aw-d7', 'sieben'],
  ['aw-d8', 'acht'],
  ['aw-d9', 'neun'],
  ['aw-zwo', 'zwo'],
  ['aw-wp-erreicht', 'Wegpunkt erreicht'],
  ['aw-neuer-kurs', 'Neuer Steuerkurs'],
  ['aw-grad', 'Grad'],
  ['aw-fuer', 'fuer'],
  ['aw-meilen', 'Meilen'],
  ['demo', 'Demo. Neuer Steuerkurs null zwo fuenf Grad. Frequenz eins zwo drei Komma vier fuenf zwo.']
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { only: null, force: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--only') out.only = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
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

async function buildPack(apiKey, pack, cfg, force) {
  const dir = path.join(VOICES_ROOT, pack.id);
  await ensureDir(dir);

  for (const [key, text] of CLIPS) {
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
    await fs.writeFile(file, audio);
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
    await buildPack(apiKey, pack, cfg, args.force);
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
