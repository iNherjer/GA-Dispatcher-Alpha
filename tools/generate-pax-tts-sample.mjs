import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'analysis', 'pax-mission-voice-styles-gemini');
const ENV_PATH = path.join(ROOT, 'key.env.local');
const MODEL = 'gemini-2.5-flash-preview-tts';
const VOICE = 'Kore';
const TEXT = 'Hey, ich sehe das Zielgebiet voraus. Wenn du noch einmal rechts herumziehst und die Hoehe haeltst, bekommen wir die Stromtrasse sauber ins Bild.';

function readEnvValue(raw, key) {
  const line = raw.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
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

const envRaw = await fs.readFile(ENV_PATH, 'utf8');
const apiKey = readEnvValue(envRaw, 'GEMINI_API_KEY');
if (!apiKey) throw new Error('GEMINI_API_KEY fehlt in key.env.local');

const payload = {
  contents: [{ role: 'user', parts: [{ text: TEXT }] }],
  generationConfig: {
    responseModalities: ['AUDIO'],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } }
  }
};

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
if (!res.ok) {
  const body = await res.text().catch(() => '');
  throw new Error(`Gemini TTS HTTP ${res.status}: ${body.slice(0, 240)}`);
}

const data = await res.json();
const inline = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
const b64 = inline?.data;
const mimeType = inline?.mimeType || '';
if (!b64) throw new Error('Gemini TTS lieferte keine inlineData');

const audioBytes = Buffer.from(b64, 'base64');
const rateMatch = mimeType.match(/rate=(\d+)/i);
const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
const outBytes = /pcm|l16/i.test(mimeType) ? pcmToWav(audioBytes, sampleRate, 1, 16) : audioBytes;

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(path.join(OUT_DIR, 'pax-mission-gemini-source.wav'), outBytes);
await fs.writeFile(path.join(OUT_DIR, 'source-meta.json'), JSON.stringify({ model: MODEL, voice: VOICE, mimeType, sampleRate, text: TEXT }, null, 2));
console.log(`Wrote ${path.relative(ROOT, path.join(OUT_DIR, 'pax-mission-gemini-source.wav'))}`);
