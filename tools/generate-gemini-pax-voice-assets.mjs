import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SURVEY_OUT_DIR = path.join(ROOT, 'audio-pax', 'gemini-survey-v1');
const DEFAULT_TRAINING_OUT_DIR = path.join(ROOT, 'audio-pax', 'gemini-training-v1');
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

const TRAINING_CLIPS = [
  {
    key: 'training_started',
    text: 'Training aktiv. Wir bewerten ab jetzt Hoehe, Kurs, Bank und saubere Korrekturen.'
  },
  {
    key: 'training_exercise_started',
    text: 'Neue Uebung. Erst stabilisieren, dann sauber und ohne Hast einleiten.'
  },
  {
    key: 'training_ready_available',
    text: 'Das ist eine gute Trainingshoehe. Stabilisiere die Maschine, und wenn du bereit bist, gib mir im Pax-Fenster die Bereitschaft.'
  },
  {
    key: 'training_optional_started',
    text: 'Zusatzuebung angenommen. Das ist freiwillig; wir fliegen sie sauber, aber der Pflichtteil ist schon erledigt.'
  },
  {
    key: 'training_instruction_turn_360_30',
    text: 'Aufgabe: ein Vollkreis mit dreissig Grad Bank. Hoehe maximal fuenfzig Fuss abweichen lassen und sauber auf Ausgangskurs ausleiten.'
  },
  {
    key: 'training_instruction_turn_360_45',
    text: 'Aufgabe: ein Vollkreis mit fuenfundvierzig Grad Bank. Hoehe verteidigen, G-Belastung ruhig halten und sauber ausleiten.'
  },
  {
    key: 'training_instruction_turn_180',
    text: 'Aufgabe: eine hundertachtzig-Grad-Wende. Hoehe halten, gleichmaessig drehen und den Zielkurs innerhalb von fuenf Grad treffen.'
  },
  {
    key: 'training_instruction_altitude_step',
    text: 'Aufgabe: eine Minute Kurs und Hoehe halten, dann fuenfhundert Fuss wechseln und danach wieder eine Minute stabil geradeaus.'
  },
  {
    key: 'training_instruction_stall',
    text: 'Aufgabe: Stall bis zum echten Break. Hoehe halten, nicht vorzeitig nachdruecken, dann sauber abfangen.'
  },
  {
    key: 'training_turn_entry',
    text: 'Jetzt den Ziel-Bankwinkel aufnehmen und die Hoehe halten.'
  },
  {
    key: 'training_turn_rollout',
    text: 'Ausleiten. Kurs sauber treffen und die Flaechen waagerecht bringen.'
  },
  {
    key: 'training_hold_course_altitude',
    text: 'Eine Minute geradeaus. Kurs und Hoehe im engen Band halten.'
  },
  {
    key: 'training_altitude_change',
    text: 'Jetzt den Hoehenwechsel einleiten. Kurs halten und die Geschwindigkeit nicht weglaufen lassen.'
  },
  {
    key: 'training_hold_new_altitude',
    text: 'Neue Hoehe erreicht. Wieder eine Minute geradeaus und stabil halten.'
  },
  {
    key: 'stall_approach',
    text: 'Stall-Uebung beginnt. Leistung rausnehmen, Kurs halten und die Hoehe weiter verteidigen.'
  },
  {
    key: 'stall_hold_to_break',
    text: 'Weiter halten. Nicht zu frueh nachdruecken, wir warten auf den echten Break.'
  },
  {
    key: 'stall_break_detected',
    text: 'Break erkannt. Jetzt abfangen, Fluegel gerade, Fahrt aufbauen und danach sanft stabilisieren.'
  },
  {
    key: 'stall_recovery',
    text: 'Recovery laeuft. Fluegel waagerecht, Stallwarnung raus und Sinkrate stoppen.'
  },
  {
    key: 'training_pass_clean',
    text: 'Sauberer Durchlauf. Die Uebung zaehlt.'
  },
  {
    key: 'training_pass_turn',
    text: 'Guter Durchlauf. Rollout und Hoehe waren sauber genug, die Wende zaehlt.'
  },
  {
    key: 'training_pass_altitude',
    text: 'Gut gehalten. Kurs und Hoehenband passen, der Hoehenwechsel zaehlt.'
  },
  {
    key: 'stall_good_recovery',
    text: 'Saubere Recovery. Break erkannt, Fluegel stabilisiert und der Hoehenverlust bleibt brauchbar.'
  },
  {
    key: 'training_required_complete',
    text: 'Pflichtteil abgeschlossen. Zwei Uebungen sind sauber genug im Kasten, du bist fuer die Rueckkehr frei. Wenn du willst, kannst du noch eine Zusatzuebung anfragen.'
  },
  {
    key: 'training_caution_altitude',
    text: 'Die Hoehe laeuft aus dem Band. Kleine Korrektur, nicht jagen.'
  },
  {
    key: 'training_caution_heading',
    text: 'Der Kurs driftet. Blick raus, Referenz halten und sanft zurueckfuehren.'
  },
  {
    key: 'training_caution_bank',
    text: 'Bankwinkel stabilisieren. Nicht nachdruecken, sauber halten.'
  },
  {
    key: 'training_caution_speed',
    text: 'Die Geschwindigkeit laeuft weg. Energie ruhiger fuehren.'
  },
  {
    key: 'training_caution_rollout_soon',
    text: 'Rollout kommt gleich. Vorplanen, Bank rausnehmen und Zielkurs treffen.'
  },
  {
    key: 'training_caution_rollout',
    text: 'Rollout noch nicht sauber. Flaechen waagerecht und Kurs ruhig einfangen.'
  },
  {
    key: 'training_caution_leveloff',
    text: 'Zielhoehe kommt. Leistung und Pitch vorbereiten, nicht durchschiessen.'
  },
  {
    key: 'training_caution_general',
    text: 'Kleine Korrektur noetig. Stabilisieren und ruhig weiterfliegen.'
  },
  {
    key: 'training_wait_altitude',
    text: 'Fuer die Uebung brauchen wir erst mehr Sicherheitshoehe. Weiter steigen und stabilisieren.'
  },
  {
    key: 'stall_caution_setup',
    text: 'Erst sauber stabilisieren: Kurs halten, Fluegel gerade, Hoehe ruhig.'
  },
  {
    key: 'stall_caution_hold_altitude',
    text: 'Hoehe weiter verteidigen. Noch nicht nachdruecken, sauber bis zum Break halten.'
  },
  {
    key: 'stall_caution_wings_level',
    text: 'Fluegel waagerecht halten. Keine Drehung in den Stall mitnehmen.'
  },
  {
    key: 'stall_caution_recovery',
    text: 'Recovery weiterfuehren: Nase loesen, Fahrt aufbauen, dann erst sanft abfangen.'
  },
  {
    key: 'stall_caution_stop_sink',
    text: 'Sinkrate stoppen. Fahrt ist wieder da, jetzt weich abfangen.'
  },
  {
    key: 'stall_caution_secondary',
    text: 'Vorsicht vor dem Sekundaerstall. Nicht zu frueh wieder ziehen.'
  },
  {
    key: 'training_repeat_altitude',
    text: 'Die Hoehe war ausserhalb der Toleranz. Wir setzen die Uebung noch einmal sauber an.'
  },
  {
    key: 'training_repeat_heading',
    text: 'Der Kurs war nicht sauber genug. Wir wiederholen mit ruhigerem Blick auf die Referenz.'
  },
  {
    key: 'training_repeat_bank',
    text: 'Bankwinkel oder Ausleitung waren nicht sauber. Wir nehmen den Durchlauf noch einmal.'
  },
  {
    key: 'training_repeat_speed',
    text: 'Die Geschwindigkeit ist zu weit weggelaufen. Bitte noch einmal mit ruhigerer Energie fuehren.'
  },
  {
    key: 'training_repeat_required',
    text: 'Kriterium verfehlt. Kein Problem, wir wiederholen die Uebung sauber.'
  },
  {
    key: 'training_complete',
    text: 'Training abgeschlossen. Wir haben die Uebungen im Kasten und werten nach der Landung kurz aus.'
  }
];

const PACKS = {
  survey: {
    clips: CLIPS,
    outDir: DEFAULT_SURVEY_OUT_DIR,
    basePath: './audio-pax/gemini-survey-v1'
  },
  training: {
    clips: TRAINING_CLIPS,
    outDir: DEFAULT_TRAINING_OUT_DIR,
    basePath: './audio-pax/gemini-training-v1'
  }
};

function usage() {
  return [
    'Usage:',
    '  node tools/generate-gemini-pax-voice-assets.mjs --takes 2 --voices all --write',
    '',
    'Options:',
    '  --write             Call Gemini and write audio files. Without this, only prints the request plan.',
    '  --catalog-only      Write catalog from existing audio files only. No Gemini requests, no API key needed.',
    '  --force             Re-render existing files.',
    '  --pack <name>       Clip pack: survey or training. Default: survey.',
    '  --takes <n>         Takes per clip and voice. Default: 2.',
    '  --voices <list>     Comma list or "all". Default: all.',
    '  --clips <list>      Comma list or "all". Default: all.',
    '  --model <id>        Gemini TTS model. Default: gemini-3.1-flash-tts-preview.',
    '  --delay-ms <n>      Delay between requests. Default: 350.',
    '  --out <dir>         Output directory. Default depends on --pack.',
    '',
    'API key:',
    '  GEMINI_API_KEY from the shell, or GEMINI_API_KEY in key.env.local.'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    pack: 'survey',
    write: false,
    catalogOnly: false,
    force: false,
    takes: DEFAULT_TAKES,
    voices: DEFAULT_VOICES.slice(),
    clipsRaw: 'all',
    clips: [],
    model: DEFAULT_MODEL,
    delayMs: DEFAULT_DELAY_MS,
    outDir: ''
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
    } else if (flag === '--pack') {
      args.pack = String(value ?? nextValue()).trim().toLowerCase() || 'survey';
    } else if (flag === '--takes') {
      args.takes = Math.max(1, Math.min(10, Number(value ?? nextValue()) || DEFAULT_TAKES));
    } else if (flag === '--voices') {
      const raw = String(value ?? nextValue()).trim();
      args.voices = raw.toLowerCase() === 'all'
        ? DEFAULT_VOICES.slice()
        : raw.split(',').map(s => s.trim()).filter(Boolean);
    } else if (flag === '--clips') {
      args.clipsRaw = String(value ?? nextValue()).trim() || 'all';
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

  const pack = PACKS[args.pack];
  if (!pack) throw new Error(`Unbekanntes Pack: ${args.pack}`);
  const rawClips = String(args.clipsRaw || 'all').trim();
  args.clips = rawClips.toLowerCase() === 'all'
    ? pack.clips.map(c => c.key)
    : rawClips.split(',').map(s => s.trim()).filter(Boolean);
  if (!args.outDir) args.outDir = pack.outDir;

  const knownClipKeys = new Set(pack.clips.map(c => c.key));
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

function maxTakeFromCatalog(catalog) {
  let maxTake = 0;
  for (const entry of Object.values(catalog?.clips || {})) {
    for (const take of entry?.takes || []) {
      maxTake = Math.max(maxTake, Number(take?.take || 0));
    }
  }
  return maxTake;
}

async function buildCatalogFromFiles({ outDir, pack, model, voices, takes, previousTakes }) {
  const catalog = {
    schema: 'ga-dispatcher-pax-static-tts-v1',
    generatedAt: new Date().toISOString(),
    model,
    basePath: pack.basePath,
    voices: voices.slice(),
    clips: {}
  };
  for (const clip of pack.clips) {
    catalog.clips[clip.key] = { text: clip.text, takes: [] };
    for (const voice of voices) {
      for (let take = 1; take <= takes; take++) {
        const existing = await firstExisting(existingClipFile(outDir, voice, clip.key, take));
        if (!existing) continue;
        const relPath = relPathFromOut(outDir, existing);
        const previousTake = previousTakes.get(`${clip.key}|${voice}|${take}|${relPath}`);
        const catalogTake = {
          voice,
          take,
          path: relPath,
          mimeType: existing.endsWith('.wav') ? 'audio/wav' : (previousTake?.mimeType || '')
        };
        if (previousTake?.sourceMimeType) catalogTake.sourceMimeType = previousTake.sourceMimeType;
        catalog.clips[clip.key].takes.push(catalogTake);
      }
    }
  }
  return catalog;
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
  const pack = PACKS[args.pack];
  const selectedClips = pack.clips.filter(c => args.clips.includes(c.key));
  const totalSlots = selectedClips.length * args.voices.length * args.takes;

  console.log(`[plan] model=${args.model}`);
  console.log(`[plan] pack=${args.pack}`);
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
  const previousCatalog = await readPreviousCatalog(args.outDir);
  const previousTakes = previousTakeMap(previousCatalog);
  const catalogVoices = Array.from(new Set([...DEFAULT_VOICES, ...args.voices]));
  const catalogTakes = Math.max(args.takes, maxTakeFromCatalog(previousCatalog));
  const catalog = {
    schema: 'ga-dispatcher-pax-static-tts-v1',
    generatedAt: new Date().toISOString(),
    model: args.model,
    basePath: pack.basePath,
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

  const fullCatalog = await buildCatalogFromFiles({
    outDir: args.outDir,
    pack,
    model: args.model,
    voices: catalogVoices,
    takes: catalogTakes,
    previousTakes
  });
  await fs.writeFile(path.join(args.outDir, 'catalog.json'), `${JSON.stringify(fullCatalog, null, 2)}\n`, 'utf8');
  console.log(`[ok] requests=${requests} missing=${missing} catalog=${path.relative(ROOT, path.join(args.outDir, 'catalog.json'))}`);
}

main().catch(err => {
  console.error('[error]', err.message || err);
  process.exit(1);
});
