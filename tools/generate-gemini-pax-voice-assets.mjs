import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'audio-pax', 'gemini-survey-v1');
const DEFAULT_MODEL = 'gemini-3.1-flash-tts-preview';
const DEFAULT_VOICES = ['Charon', 'Puck', 'Kore', 'Leda', 'Aoede'];
const DEFAULT_TAKES = 2;
const DEFAULT_DELAY_MS = 350;

const CLIPS = [
  {
    key: 'scan_survey_area_entered',
    text: 'Wir sind im Surveybereich. Such dir ein Linienende und flieg die erste Bahn sauber durch.'
  },
  {
    key: 'orbit_survey_area_entered',
    text: 'Wir sind im Surveybereich. Nimm jetzt den markierten Orbit auf und halte Hoehe und Radius stabil.'
  },
  {
    key: 'line_complete',
    text: 'Gut, diese Bahn ist sauber. Nimm dir jetzt die nächste Linie, die Reihenfolge ist egal.'
  },
  {
    key: 'line_reset_altitude',
    text: 'Die Höhe passt nicht mehr, die aktuelle Bahn zählt nicht. Wir setzen die Linie noch einmal sauber an.'
  },
  {
    key: 'line_reset_offtrack',
    text: 'Wir sind zu weit aus der Bahn gedriftet. Diese Linie bitte noch einmal ruhig und gerade aufnehmen.'
  },
  {
    key: 'orbit_turn_complete',
    text: 'Sauber, dieser Kreis zählt. Bleib im gleichen Radius und nimm den nächsten Umlauf mit.'
  },
  {
    key: 'orbit_reset_altitude',
    text: 'Die Höhe ist aus dem Band gelaufen, der aktuelle Kreis zählt nicht. Bitte wieder stabilisieren und neu ansetzen.'
  },
  {
    key: 'orbit_reset_offtrack',
    text: 'Der Radius läuft weg, der aktuelle Kreis zählt nicht. Bitte zurück auf den Ring und neu ansetzen.'
  },
  {
    key: 'scan_survey_complete',
    text: 'Alle Survey-Linien sind sauber abgedeckt. Auftrag erfüllt, wir gehen zurück zum Heimatplatz.'
  },
  {
    key: 'orbit_survey_complete',
    text: 'Das waren alle Kreise, der Survey ist komplett. Auftrag erfüllt, wir gehen zurück zum Heimatplatz.'
  }
];

function usage() {
  return [
    'Usage:',
    '  node tools/generate-gemini-pax-voice-assets.mjs --takes 2 --voices all --write',
    '',
    'Options:',
    '  --write             Call Gemini and write audio files. Without this, only prints the request plan.',
    '  --catalog-only      Write catalog from existing audio files only. No Gemini requests, no API key needed.',
    '  --force             Re-render existing files.',
    '  --takes <n>         Takes per clip and voice. Default: 2.',
    '  --voices <list>     Comma list or "all". Default: all.',
    '  --clips <list>      Comma list or "all". Default: all.',
    '  --model <id>        Gemini TTS model. Default: gemini-3.1-flash-tts-preview.',
    '  --delay-ms <n>      Delay between requests. Default: 350.',
    '  --out <dir>         Output directory. Default: audio-pax/gemini-survey-v1.',
    '',
    'API key:',
    '  GEMINI_API_KEY from the shell, or GEMINI_API_KEY in key.env.local.'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    write: false,
    catalogOnly: false,
    force: false,
    takes: DEFAULT_TAKES,
    voices: DEFAULT_VOICES.slice(),
    clips: CLIPS.map(c => c.key),
    model: DEFAULT_MODEL,
    delayMs: DEFAULT_DELAY_MS,
    outDir: DEFAULT_OUT_DIR
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const nextValue = () => {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} braucht einen Wert`);
      return value;
    };
    const [flag, inline] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, null];
    const value = inline != null ? inline : null;
    if (flag === '--help' || flag === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (flag === '--write') {
      args.write = true;
    } else if (flag === '--catalog-only') {
      args.catalogOnly = true;
    } else if (flag === '--force') {
      args.force = true;
    } else if (flag === '--takes') {
      args.takes = Math.max(1, Math.min(10, Number(value ?? nextValue()) || DEFAULT_TAKES));
    } else if (flag === '--voices') {
      const raw = String(value ?? nextValue()).trim();
      args.voices = raw.toLowerCase() === 'all'
        ? DEFAULT_VOICES.slice()
        : raw.split(',').map(s => s.trim()).filter(Boolean);
    } else if (flag === '--clips') {
      const raw = String(value ?? nextValue()).trim();
      args.clips = raw.toLowerCase() === 'all'
        ? CLIPS.map(c => c.key)
        : raw.split(',').map(s => s.trim()).filter(Boolean);
    } else if (flag === '--model') {
      args.model = String(value ?? nextValue()).trim() || DEFAULT_MODEL;
    } else if (flag === '--delay-ms') {
      args.delayMs = Math.max(0, Number(value ?? nextValue()) || DEFAULT_DELAY_MS);
    } else if (flag === '--out') {
      args.outDir = path.resolve(ROOT, String(value ?? nextValue()).trim());
    } else {
      throw new Error(`Unbekannte Option: ${arg}`);
    }
  }

  const knownClipKeys = new Set(CLIPS.map(c => c.key));
  const unknownClips = args.clips.filter(k => !knownClipKeys.has(k));
  if (unknownClips.length) throw new Error(`Unbekannte Clips: ${unknownClips.join(', ')}`);
  const knownVoices = new Set(DEFAULT_VOICES.map(v => v.toLowerCase()));
  const unknownVoices = args.voices.filter(v => !knownVoices.has(String(v).toLowerCase()));
  if (unknownVoices.length) throw new Error(`Unbekannte Stimmen: ${unknownVoices.join(', ')}`);
  return args;
}

async function readEnvValueFromFile(file, key) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const line = raw.split(/\r?\n/).find(entry => entry.trim().startsWith(`${key}=`));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  } catch (_) {
    return '';
  }
}

async function resolveApiKey() {
  return process.env.GEMINI_API_KEY
    || await readEnvValueFromFile(path.join(ROOT, 'key.env.local'), 'GEMINI_API_KEY');
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const bytesPerSample = bitDepth / 8;
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + pcm.length, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  wav.writeUInt16LE(channels * bytesPerSample, 32);
  wav.writeUInt16LE(bitDepth, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm.length, 40);
  pcm.copy(wav, 44);
  return wav;
}

function relPathFromOut(outDir, file) {
  return path.relative(outDir, file).split(path.sep).join('/');
}

function existingClipFile(outDir, voice, clipKey, take) {
  const base = path.join(outDir, 'clips', voice, `${clipKey}-t${String(take).padStart(2, '0')}`);
  return ['wav', 'mp3', 'ogg', 'bin'].map(ext => `${base}.${ext}`);
}

async function firstExisting(paths) {
  for (const file of paths) {
    try {
      const stat = await fs.stat(file);
      if (stat.isFile()) return file;
    } catch (_) {}
  }
  return '';
}

async function readPreviousCatalog(outDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(outDir, 'catalog.json'), 'utf8'));
  } catch (_) {
    return null;
  }
}

function previousTakeMap(catalog) {
  const map = new Map();
  for (const [clipKey, entry] of Object.entries(catalog?.clips || {})) {
    for (const take of entry?.takes || []) {
      const key = `${clipKey}|${take.voice}|${take.take}|${take.path}`;
      map.set(key, take);
    }
  }
  return map;
}

async function requestGeminiTts(apiKey, model, text, voice) {
  const payload = {
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
    }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini TTS HTTP ${res.status}: ${body.slice(0, 240)}`);
  }
  const data = await res.json();
  const inline = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  const b64 = inline?.data;
  const mimeType = inline?.mimeType || '';
  if (!b64) throw new Error('Gemini TTS lieferte keine inlineData');
  return { bytes: Buffer.from(b64, 'base64'), mimeType };
}

function encodeAudioForFile(bytes, mimeType) {
  const mimeLower = String(mimeType || '').toLowerCase();
  if (!mimeType || mimeLower.includes('pcm') || mimeLower.includes('l16')) {
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
    return { bytes: pcmToWav(bytes, sampleRate, 1, 16), ext: 'wav', mimeType: 'audio/wav' };
  }
  if (mimeLower.includes('mpeg') || mimeLower.includes('mp3')) return { bytes, ext: 'mp3', mimeType };
  if (mimeLower.includes('ogg')) return { bytes, ext: 'ogg', mimeType };
  return { bytes, ext: 'bin', mimeType };
}

async function delay(ms) {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs();
  const selectedClips = CLIPS.filter(c => args.clips.includes(c.key));
  const totalSlots = selectedClips.length * args.voices.length * args.takes;

  console.log(`[plan] model=${args.model}`);
  console.log(`[plan] voices=${args.voices.join(', ')}`);
  console.log(`[plan] clips=${selectedClips.map(c => c.key).join(', ')}`);
  console.log(`[plan] takes=${args.takes} | slots=${totalSlots}`);
  console.log(`[plan] out=${path.relative(ROOT, args.outDir)}`);

  if (!args.write && !args.catalogOnly) {
    console.log('[dry-run] Keine API-Requests. Mit --write rendern.');
    return;
  }

  const apiKey = args.catalogOnly ? '' : await resolveApiKey();
  if (!args.catalogOnly && !apiKey) throw new Error('GEMINI_API_KEY fehlt in der Shell oder in key.env.local');

  await fs.mkdir(args.outDir, { recursive: true });
  const previousTakes = previousTakeMap(await readPreviousCatalog(args.outDir));
  const catalog = {
    schema: 'ga-dispatcher-pax-static-tts-v1',
    generatedAt: new Date().toISOString(),
    model: args.model,
    basePath: './audio-pax/gemini-survey-v1',
    voices: args.voices.slice(),
    clips: {}
  };

  let requests = 0;
  let missing = 0;
  for (const clip of selectedClips) {
    catalog.clips[clip.key] = { text: clip.text, takes: [] };
    for (const voice of args.voices) {
      for (let take = 1; take <= args.takes; take++) {
        const existing = args.force ? '' : await firstExisting(existingClipFile(args.outDir, voice, clip.key, take));
        if (existing) {
          const relPath = relPathFromOut(args.outDir, existing);
          const previousTake = previousTakes.get(`${clip.key}|${voice}|${take}|${relPath}`);
          const catalogTake = {
            voice,
            take,
            path: relPath,
            mimeType: existing.endsWith('.wav') ? 'audio/wav' : (previousTake?.mimeType || '')
          };
          if (previousTake?.sourceMimeType) catalogTake.sourceMimeType = previousTake.sourceMimeType;
          catalog.clips[clip.key].takes.push({
            ...catalogTake
          });
          console.log(`[skip] ${voice} ${clip.key} take ${take}: exists`);
          continue;
        }

        if (args.catalogOnly) {
          missing++;
          console.log(`[missing] ${voice} ${clip.key} take ${take}: no file`);
          continue;
        }

        requests++;
        console.log(`[tts] ${voice} ${clip.key} take ${take}`);
        const audio = await requestGeminiTts(apiKey, args.model, clip.text, voice);
        const encoded = encodeAudioForFile(audio.bytes, audio.mimeType);
        const outFile = path.join(args.outDir, 'clips', voice, `${clip.key}-t${String(take).padStart(2, '0')}.${encoded.ext}`);
        await fs.mkdir(path.dirname(outFile), { recursive: true });
        await fs.writeFile(outFile, encoded.bytes);
        catalog.clips[clip.key].takes.push({
          voice,
          take,
          path: relPathFromOut(args.outDir, outFile),
          mimeType: encoded.mimeType,
          sourceMimeType: audio.mimeType
        });
        await delay(args.delayMs);
      }
    }
  }

  await fs.writeFile(path.join(args.outDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`[ok] requests=${requests} missing=${missing} catalog=${path.relative(ROOT, path.join(args.outDir, 'catalog.json'))}`);
}

main().catch(err => {
  console.error('[error]', err.message || err);
  process.exit(1);
});
