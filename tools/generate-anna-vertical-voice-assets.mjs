#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { VERTICAL_WARNING_CLIPS } from './vertical-warning-voice-clips.mjs';

const run = promisify(execFile);
const outputDir = path.join(process.cwd(), 'audio-warnings');
const force = process.argv.includes('--force');
const voice = 'Anna';
const rate = 182;

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'anna-vertical-'));
  await fs.mkdir(outputDir, { recursive: true });
  try {
    for (const clip of VERTICAL_WARNING_CLIPS.de) {
      const output = path.join(outputDir, `${clip.key}.m4a`);
      if (!force && await fs.stat(output).then(() => true, () => false)) continue;
      const source = path.join(temporary, `${clip.key}.aiff`);
      const encoded = path.join(temporary, `${clip.key}.m4a`);
      await run('say', ['-v', voice, '-r', String(rate), '-o', source, '--', clip.text]);
      await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', source,
        '-af', 'silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB',
        '-c:a', 'aac', '-b:a', '128k', '-ac', '1', '-ar', '44100', encoded]);
      const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', encoded]);
      const duration = Number(stdout.trim());
      if (!Number.isFinite(duration) || duration < 0.12) throw new Error(`Invalid audio: ${clip.key}`);
      await fs.copyFile(encoded, output);
      process.stdout.write(`[ok] ${clip.key}.m4a (${duration.toFixed(2)}s)\n`);
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error('[error]', error.message); process.exitCode = 1; });
