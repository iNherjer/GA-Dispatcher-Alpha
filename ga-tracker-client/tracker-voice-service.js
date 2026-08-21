'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const boardingVoiceCore = require('../mission-boarding-voice-core.js');

const VOICE_PROVIDERS = new Set(['gemini', 'openai']);
const EFFECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const DEFAULT_MAX_ENTRIES = 64;
const DEFAULT_MAX_AUDIO_BYTES = 48 * 1024 * 1024;
const DEFAULT_PLAYBACK_LEASE_MS = 30000;
const DEFAULT_MAX_PENDING_JOBS = 16;
const DEFAULT_MAX_PROVIDER_CONCURRENCY = 2;
const DEFAULT_MAX_NEW_JOBS_PER_MINUTE = 60;

function voiceError(code, statusCode, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeVoiceProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VOICE_PROVIDERS.has(normalized) ? normalized : 'gemini';
}

function normalizeEffectId(value) {
  const effectId = String(value || '').trim();
  if (!EFFECT_ID_PATTERN.test(effectId)) throw voiceError('invalid_effect_id', 400, 'Ungueltige Voice-Effekt-ID.');
  return effectId;
}

function normalizeVoiceRequest(value = {}) {
  const effectId = normalizeEffectId(value.effectId);
  const text = String(value.text || '').trim();
  const prompt = String(value.prompt || '').trim();
  const fallbackText = String(value.fallbackText || '').trim();
  if (text.length > 4000 || fallbackText.length > 4000 || prompt.length > 24000 || (!text && !fallbackText && !prompt)) {
    throw voiceError('invalid_voice_text', 400, 'Voice-Text fehlt oder ist zu lang.');
  }
  const speaker = value.speaker && typeof value.speaker === 'object' && !Array.isArray(value.speaker)
    ? value.speaker
    : {};
  const normalizedSpeaker = boardingVoiceCore.normalizeSpeaker(speaker);
  const voiceName = String(value.voiceName || '').trim().slice(0, 80);
  const normalizeModels = (raw, fallback, max = 8) => (Array.isArray(raw) ? raw : fallback)
    .map((entry) => String(Array.isArray(entry) ? entry[0] : entry || '').trim().slice(0, 100))
    .filter((entry, index, list) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(entry) && list.indexOf(entry) === index)
    .slice(0, max);
  const textModelSource = value.textModels && typeof value.textModels === 'object' && !Array.isArray(value.textModels)
    ? value.textModels
    : {};
  const requestedKind = String(value.kind || '').trim().toLowerCase();
  const kind = requestedKind === 'boarding' || requestedKind === 'farewell' ? requestedKind : 'direct';
  const cueSource = value.cue && typeof value.cue === 'object' && !Array.isArray(value.cue) ? value.cue : {};
  const cueId = kind === 'boarding' || kind === 'farewell'
    ? boardingVoiceCore.normalizeCueId(cueSource.id)
    : 'none';
  return {
    effectId,
    text,
    prompt,
    fallbackText,
    kind,
    synthesizeAudio: value.synthesizeAudio !== false,
    taskDomain: String(value.taskDomain || normalizedSpeaker.taskDomain || '').trim().toLowerCase().slice(0, 120),
    gender: normalizedSpeaker.gender,
    voiceName,
    speaker: normalizedSpeaker,
    cue: {
      id: cueId,
      variantSeed: cueId === 'none' ? '' : String(cueSource.variantSeed || '').trim().slice(0, 500),
      gain: cueId === 'none' ? 0 : Math.max(0, Math.min(1, Number(cueSource.gain) || 0.38))
    },
    textModels: {
      gemini: normalizeModels(textModelSource.gemini, boardingVoiceCore.GEMINI_TEXT_MODELS),
      openai: normalizeModels(textModelSource.openai, boardingVoiceCore.OPENAI_TEXT_MODELS)
    },
    ttsModels: normalizeModels(value.ttsModels, boardingVoiceCore.GEMINI_TTS_MODELS, 4),
    ttsHedgeEnabled: value.ttsHedgeEnabled !== false,
    ttsHedgeDelayMs: Math.max(1000, Math.min(10000, Math.round(Number(value.ttsHedgeDelayMs) || 3000)))
  };
}

function writeAscii(buffer, offset, value) {
  buffer.write(String(value), offset, 'ascii');
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const source = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm || '');
  const wav = Buffer.allocUnsafe(44 + source.length);
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  writeAscii(wav, 0, 'RIFF');
  wav.writeUInt32LE(36 + source.length, 4);
  writeAscii(wav, 8, 'WAVE');
  writeAscii(wav, 12, 'fmt ');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitDepth, 34);
  writeAscii(wav, 36, 'data');
  wav.writeUInt32LE(source.length, 40);
  source.copy(wav, 44);
  return wav;
}

function normalizeGeminiAudio(buffer, mimeType) {
  const normalizedMime = String(mimeType || '').trim().toLowerCase();
  if (!normalizedMime || normalizedMime.includes('pcm') || normalizedMime.includes('l16')) {
    const sampleRateMatch = normalizedMime.match(/rate=(\d{4,6})/);
    const sampleRate = Number(sampleRateMatch?.[1]) || 24000;
    return { audio: pcmToWav(buffer, sampleRate, 1, 16), contentType: 'audio/wav' };
  }
  return { audio: Buffer.from(buffer), contentType: String(mimeType || 'application/octet-stream') };
}

async function generateOpenAiText({ apiKey, request, fetchRemote }) {
  for (const model of request.textModels.openai) {
    try {
      const response = await fetchRemote('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Schreibe kurze, natuerliche deutsche Passenger-Voice-Zeilen. Keine Markdown-Formatierung.' },
            { role: 'user', content: request.prompt }
          ]
        })
      });
      if (!response?.ok) continue;
      const data = await response.json();
      const generatedText = String(data?.choices?.[0]?.message?.content || '').trim();
      if (generatedText) return { generatedText, textModel: model };
    } catch (_) {}
  }
  return { generatedText: '', textModel: '' };
}

async function generateGeminiText({ apiKey, request, fetchRemote }) {
  for (const model of request.textModels.gemini) {
    try {
      const response = await fetchRemote(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
          generationConfig: { response_mime_type: 'text/plain', temperature: 0.95, topP: 0.9 }
        })
      });
      if (!response?.ok) continue;
      const data = await response.json();
      const generatedText = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (generatedText) return { generatedText, textModel: model };
    } catch (_) {}
  }
  return { generatedText: '', textModel: '' };
}

async function resolveRequestText({ provider, apiKey, request, fetchRemote }) {
  if (request.text) return { text: request.text, textModel: '' };
  let generated = { generatedText: '', textModel: '' };
  if (request.prompt) {
    try {
      generated = provider === 'openai'
        ? await generateOpenAiText({ apiKey, request, fetchRemote })
        : await generateGeminiText({ apiKey, request, fetchRemote });
    } catch (_) {}
  }
  const text = request.kind === 'boarding'
    ? boardingVoiceCore.finalizeBoardingText({
      generatedText: generated.generatedText,
      fallbackText: request.fallbackText,
      taskDomain: request.taskDomain
    })
    : (boardingVoiceCore.normalizeSpokenText(generated.generatedText) || request.text || request.fallbackText);
  if (!text) throw voiceError('voice_text_generation_empty', 502, 'Voice-Textgenerierung lieferte keinen verwendbaren Text.');
  return { text, textModel: generated.textModel };
}

async function synthesizeOpenAi({ apiKey, request, fetchRemote }) {
  const model = 'gpt-4o-mini-tts';
  let lastStatus = 0;
  for (const voiceName of boardingVoiceCore.voiceCandidates('openai', request.speaker, request.voiceName)) {
    try {
      const response = await fetchRemote('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice: voiceName, input: request.text, response_format: 'mp3' })
      });
      lastStatus = Number(response?.status) || 0;
      if (!response?.ok) continue;
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length) return { audio, contentType: 'audio/mpeg', model, voiceName };
    } catch (_) {}
  }
  throw voiceError('voice_provider_error', 502, `OpenAI TTS antwortete ohne Audio${lastStatus ? ` (HTTP ${lastStatus})` : ''}.`);
}

async function synthesizeGeminiModel({ apiKey, request, fetchRemote, model, signal = null }) {
  let lastStatus = 0;
  for (const voiceName of boardingVoiceCore.voiceCandidates('gemini', request.speaker, request.voiceName)) {
    try {
      const response = await fetchRemote(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: request.text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
          }
        }),
        ...(signal ? { signal } : {})
      });
      lastStatus = Number(response?.status) || 0;
      if (!response?.ok) continue;
      const data = await response.json();
      const inlineData = data?.candidates?.[0]?.content?.parts?.find?.((part) => part?.inlineData?.data)?.inlineData
        || data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const audio = Buffer.from(String(inlineData?.data || ''), 'base64');
      if (audio.length) return { ...normalizeGeminiAudio(audio, inlineData?.mimeType), model, voiceName };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }
  }
  throw voiceError('voice_provider_error', 502, `Gemini TTS ${model} antwortete ohne Audio${lastStatus ? ` (HTTP ${lastStatus})` : ''}.`);
}

async function synthesizeGemini({ apiKey, request, fetchRemote }) {
  const models = request.ttsModels.length ? request.ttsModels : boardingVoiceCore.GEMINI_TTS_MODELS;
  if (request.ttsHedgeEnabled !== true || models.length < 2) {
    let lastError = null;
    for (const model of models) {
      try {
        return await synthesizeGeminiModel({ apiKey, request, fetchRemote, model });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || voiceError('voice_provider_error', 502, 'Gemini TTS antwortete ohne Audio.');
  }
  const canAbort = typeof AbortController === 'function';
  const primaryController = canAbort ? new AbortController() : null;
  const fallbackController = canAbort ? new AbortController() : null;
  return new Promise((resolve, reject) => {
    let settled = false;
    let primaryDone = false;
    let fallbackStarted = false;
    let fallbackDone = false;
    let lastError = null;
    let timer = null;
    const finish = (result, source) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (source === 'primary') fallbackController?.abort();
        else primaryController?.abort();
      } catch (_) {}
      resolve(result);
    };
    const maybeReject = () => {
      if (!settled && primaryDone && fallbackDone) {
        settled = true;
        reject(lastError || voiceError('voice_provider_error', 502, 'Gemini TTS antwortete ohne Audio.'));
      }
    };
    const startFallback = () => {
      if (settled || fallbackStarted) return;
      fallbackStarted = true;
      synthesizeGeminiModel({ apiKey, request, fetchRemote, model: models[1], signal: fallbackController?.signal })
        .then((result) => finish(result, 'fallback'))
        .catch((error) => { if (error?.name !== 'AbortError') lastError = error; })
        .finally(() => { fallbackDone = true; maybeReject(); });
    };
    synthesizeGeminiModel({ apiKey, request, fetchRemote, model: models[0], signal: primaryController?.signal })
      .then((result) => finish(result, 'primary'))
      .catch((error) => {
        if (error?.name !== 'AbortError') lastError = error;
        startFallback();
      })
      .finally(() => { primaryDone = true; maybeReject(); });
    timer = setTimeout(startFallback, request.ttsHedgeDelayMs);
  });
}

function createTrackerVoiceService(options = {}) {
  const provider = normalizeVoiceProvider(options.provider);
  const apiKey = String(options.apiKey || '').trim();
  const fetchRemote = typeof options.fetchRemote === 'function' ? options.fetchRemote : globalThis.fetch;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const maxEntries = Math.max(4, Math.min(256, Number(options.maxEntries) || DEFAULT_MAX_ENTRIES));
  const maxAudioBytes = Math.max(1024 * 1024, Number(options.maxAudioBytes) || DEFAULT_MAX_AUDIO_BYTES);
  const maxPendingJobs = Math.max(1, Math.min(64, Number(options.maxPendingJobs) || DEFAULT_MAX_PENDING_JOBS));
  const maxProviderConcurrency = Math.max(1, Math.min(4, Number(options.maxProviderConcurrency) || DEFAULT_MAX_PROVIDER_CONCURRENCY));
  const storageFile = String(options.storageFile || '').trim();
  const audioCueDirectory = options.audioCueDirectory === false
    ? ''
    : path.resolve(String(options.audioCueDirectory || path.join(__dirname, '..', 'audio-cues')));
  const io = options.io && typeof options.io === 'object' ? options.io : fs;
  const records = new Map();
  const providerQueue = [];
  const newJobTimestamps = [];
  const playbackWaiters = new Map();
  let totalAudioBytes = 0;
  let activeProviderJobs = 0;

  const configured = Boolean(apiKey && typeof fetchRemote === 'function');

  function resolveAudioCue(cue) {
    const source = cue && typeof cue === 'object' && !Array.isArray(cue) ? cue : {};
    const id = boardingVoiceCore.normalizeCueId(source.id);
    if (!audioCueDirectory || id === 'none') return null;
    try {
      const availableNames = io.readdirSync(audioCueDirectory, { withFileTypes: true })
        .filter((entry) => entry?.isFile?.() && /\.mp3$/i.test(entry.name))
        .map((entry) => entry.name);
      const assetName = boardingVoiceCore.selectAudioCueAsset({
        id,
        variantSeed: String(source.variantSeed || '').trim().slice(0, 500)
      }, availableNames);
      if (!assetName) return null;
      return {
        id,
        variantSeed: String(source.variantSeed || '').trim().slice(0, 500),
        gain: Math.max(0, Math.min(1, Number(source.gain) || 0.38)),
        assetName,
        filePath: path.join(audioCueDirectory, assetName)
      };
    } catch (_) {
      return null;
    }
  }

  function publicRecord(record) {
    if (!record) return null;
    const playback = record.playback || {};
    return {
      effectId: record.effectId,
      kind: record.kind || 'direct',
      synthesizeAudio: record.synthesizeAudio !== false,
      status: record.status,
      provider: record.provider,
      model: record.model || '',
      textModel: record.textModel || '',
      voiceName: record.voiceName || '',
      text: record.text || '',
      speaker: { ...record.speaker },
      cue: {
        id: record.cue?.id || 'none',
        audioAvailable: Boolean(record.cue?.filePath),
        gain: Number(record.cue?.gain) || 0
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      audioAvailable: record.status === 'ready' && Buffer.isBuffer(record.audio),
      contentType: record.contentType || '',
      byteLength: Number(record.audio?.length) || 0,
      error: record.error || '',
      playback: {
        status: playback.status || 'available',
        ownerClientId: playback.ownerClientId || '',
        leaseUntil: Number(playback.leaseUntil) || null,
        completedAt: Number(playback.completedAt) || null
      }
    };
  }

  function evict() {
    if (records.size <= maxEntries && totalAudioBytes <= maxAudioBytes) return;
    const candidates = [...records.values()]
      .filter((record) => record.status !== 'pending' && record.playback?.status !== 'claimed')
      .sort((left, right) => left.updatedAt - right.updatedAt);
    for (const record of candidates) {
      if (records.size <= maxEntries && totalAudioBytes <= maxAudioBytes) break;
      records.delete(record.effectId);
      totalAudioBytes -= Number(record.audio?.length) || 0;
    }
  }

  function persist() {
    if (!storageFile) return true;
    try {
      const directory = path.dirname(storageFile);
      const temporaryFile = `${storageFile}.tmp`;
      io.mkdirSync(directory, { recursive: true });
      const storedRecords = [...records.values()]
        .filter((record) => record.status === 'ready' && (Buffer.isBuffer(record.audio) || record.synthesizeAudio === false))
        .map((record) => ({
          effectId: record.effectId,
          fingerprint: record.fingerprint,
          kind: record.kind || 'direct',
          synthesizeAudio: record.synthesizeAudio !== false,
          provider: record.provider,
          speaker: record.speaker,
          cue: record.cue ? {
            id: record.cue.id,
            variantSeed: record.cue.variantSeed,
            gain: record.cue.gain,
            assetName: record.cue.assetName
          } : null,
          status: 'ready',
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          text: record.text || '',
          textModel: record.textModel || '',
          contentType: record.contentType || '',
          model: record.model || '',
          voiceName: record.voiceName || '',
          playback: record.playback,
          audioBase64: Buffer.isBuffer(record.audio) ? record.audio.toString('base64') : ''
        }));
      io.writeFileSync(temporaryFile, JSON.stringify({ schema: 'ga.tracker-voice-cache.v1', records: storedRecords }), { mode: 0o600 });
      io.renameSync(temporaryFile, storageFile);
      return true;
    } catch (error) {
      log(`VOICE_CACHE_WRITE_ERROR code=${error?.code || error?.message || error}`);
      return false;
    }
  }

  function loadPersisted() {
    if (!storageFile || !io.existsSync(storageFile)) return;
    try {
      const parsed = JSON.parse(io.readFileSync(storageFile, 'utf8'));
      if (parsed?.schema !== 'ga.tracker-voice-cache.v1' || !Array.isArray(parsed.records)) return;
      for (const source of parsed.records.slice(-maxEntries)) {
        const effectId = normalizeEffectId(source?.effectId);
        const audio = Buffer.from(String(source?.audioBase64 || ''), 'base64');
        const synthesizeAudio = source?.synthesizeAudio !== false;
        if ((synthesizeAudio && !audio.length) || totalAudioBytes + audio.length > maxAudioBytes) continue;
        const timestamp = Math.max(0, Number(source.updatedAt) || Number(source.createdAt) || now());
        const playback = source.playback && typeof source.playback === 'object' ? source.playback : {};
        const cue = resolveAudioCue(source.cue);
        const record = {
          effectId,
          fingerprint: String(source.fingerprint || ''),
          kind: ['boarding', 'farewell'].includes(String(source.kind || '').trim().toLowerCase())
            ? String(source.kind || '').trim().toLowerCase()
            : 'direct',
          synthesizeAudio,
          provider: normalizeVoiceProvider(source.provider),
          speaker: boardingVoiceCore.normalizeSpeaker(source.speaker),
          cue,
          status: 'ready',
          createdAt: Math.max(0, Number(source.createdAt) || timestamp),
          updatedAt: timestamp,
          text: String(source.text || '').trim().slice(0, 4000),
          textModel: String(source.textModel || '').trim().slice(0, 100),
          audio: audio.length ? audio : null,
          contentType: String(source.contentType || 'application/octet-stream').slice(0, 120),
          model: String(source.model || '').slice(0, 100),
          voiceName: String(source.voiceName || '').slice(0, 80),
          error: '',
          playback: playback.status === 'completed'
            ? { status: 'completed', ownerClientId: String(playback.ownerClientId || '').slice(0, 160), leaseUntil: 0, completedAt: Number(playback.completedAt) || timestamp }
            : { status: 'available', ownerClientId: '', leaseUntil: 0, completedAt: 0 },
          promise: null
        };
        records.set(effectId, record);
        totalAudioBytes += audio.length;
      }
      log(`VOICE_CACHE_LOADED jobs=${records.size} bytes=${totalAudioBytes}`);
    } catch (error) {
      log(`VOICE_CACHE_READ_ERROR code=${error?.code || error?.message || error}`);
    }
  }

  function settlePlaybackWaiters(effectId, result) {
    const waiters = playbackWaiters.get(effectId) || [];
    playbackWaiters.delete(effectId);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(result);
    }
  }

  loadPersisted();

  async function produce(record, request) {
    try {
      const resolvedText = await resolveRequestText({ provider, apiKey, request, fetchRemote });
      if (record.cancelled === true) return publicRecord(record);
      request = { ...request, text: resolvedText.text };
      record.text = resolvedText.text;
      record.textModel = resolvedText.textModel;
      if (request.synthesizeAudio === false) {
        record.status = 'ready';
        record.updatedAt = now();
        log(`VOICE_TEXT_READY effectId=${record.effectId} provider=${provider} model=${record.textModel || 'fallback'}`);
        persist();
        return publicRecord(record);
      }
      const result = provider === 'openai'
        ? await synthesizeOpenAi({ apiKey, request, fetchRemote })
        : await synthesizeGemini({ apiKey, request, fetchRemote });
      if (record.cancelled === true) return publicRecord(record);
      record.audio = result.audio;
      record.contentType = result.contentType;
      record.model = result.model;
      record.voiceName = result.voiceName;
      record.status = 'ready';
      record.updatedAt = now();
      totalAudioBytes += result.audio.length;
      log(`VOICE_TTS_READY effectId=${record.effectId} provider=${provider} model=${result.model} bytes=${result.audio.length}`);
      evict();
      persist();
      return publicRecord(record);
    } catch (error) {
      record.status = 'failed';
      record.error = error?.code || 'voice_generation_failed';
      record.updatedAt = now();
      log(`VOICE_TTS_ERROR effectId=${record.effectId} provider=${provider} code=${record.error}`);
      settlePlaybackWaiters(record.effectId, { status: 'failed', completed: false, job: publicRecord(record) });
      return publicRecord(record);
    } finally {
      record.promise = null;
    }
  }

  function drainProviderQueue() {
    while (activeProviderJobs < maxProviderConcurrency && providerQueue.length) {
      const queued = providerQueue.shift();
      activeProviderJobs += 1;
      produce(queued.record, queued.request)
        .then(queued.resolve)
        .finally(() => {
          activeProviderJobs -= 1;
          drainProviderQueue();
        });
    }
  }

  function schedule(record, request) {
    record.promise = new Promise((resolve) => providerQueue.push({ record, request, resolve }));
    drainProviderQueue();
  }

  function request(rawRequest) {
    const request = normalizeVoiceRequest(rawRequest);
    const fingerprint = crypto.createHash('sha256')
      .update(JSON.stringify({
        provider,
        text: request.text,
        prompt: request.prompt,
        fallbackText: request.fallbackText,
        kind: request.kind,
        synthesizeAudio: request.synthesizeAudio,
        taskDomain: request.taskDomain,
        speaker: request.speaker,
        cue: request.cue,
        voiceName: request.voiceName,
        textModels: request.textModels,
        ttsModels: request.ttsModels,
        ttsHedgeEnabled: request.ttsHedgeEnabled,
        ttsHedgeDelayMs: request.ttsHedgeDelayMs
      }))
      .digest('hex');
    const existing = records.get(request.effectId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw voiceError('effect_id_conflict', 409, 'Diese Voice-Effekt-ID gehoert bereits zu einem anderen Inhalt.');
      }
      return publicRecord(existing);
    }
    if (!configured) throw voiceError('voice_not_configured', 503, 'Zentrale Voice-Ausgabe ist im Tracker nicht konfiguriert.');
    const timestamp = now();
    while (newJobTimestamps.length && timestamp - newJobTimestamps[0] >= 60000) newJobTimestamps.shift();
    if (newJobTimestamps.length >= DEFAULT_MAX_NEW_JOBS_PER_MINUTE) {
      throw voiceError('voice_rate_limited', 429, 'Zu viele neue Voice-Auftraege in kurzer Zeit.');
    }
    const pendingJobs = [...records.values()].filter((record) => record.status === 'pending').length;
    if (pendingJobs >= maxPendingJobs) throw voiceError('voice_queue_full', 429, 'Die Voice-Warteschlange ist voll.');
    newJobTimestamps.push(timestamp);
    const record = {
      effectId: request.effectId,
      fingerprint,
      kind: request.kind,
      synthesizeAudio: request.synthesizeAudio,
      provider,
      speaker: request.speaker,
      cue: resolveAudioCue(request.cue),
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      text: request.text,
      textModel: '',
      audio: null,
      contentType: '',
      model: '',
      voiceName: request.voiceName,
      error: '',
      playback: { status: 'available', ownerClientId: '', leaseUntil: 0, completedAt: 0 },
      promise: null
    };
    records.set(record.effectId, record);
    schedule(record, request);
    evict();
    return publicRecord(record);
  }

  function get(effectId) {
    return publicRecord(records.get(normalizeEffectId(effectId)));
  }

  function cancel(effectId, reason = 'voice_cancelled') {
    const normalizedEffectId = normalizeEffectId(effectId);
    const record = records.get(normalizedEffectId);
    if (!record) return { cancelled: false, reason: 'missing', job: null };
    records.delete(normalizedEffectId);
    if (Buffer.isBuffer(record.audio)) totalAudioBytes = Math.max(0, totalAudioBytes - record.audio.length);
    record.cancelled = true;
    record.status = 'cancelled';
    record.error = String(reason || 'voice_cancelled').trim().slice(0, 180);
    record.updatedAt = now();
    settlePlaybackWaiters(normalizedEffectId, { status: 'cancelled', completed: false, job: publicRecord(record) });
    persist();
    return { cancelled: true, reason: record.error, job: publicRecord(record) };
  }

  function getAudio(effectId) {
    const record = records.get(normalizeEffectId(effectId));
    if (!record || record.status !== 'ready' || !Buffer.isBuffer(record.audio)) return null;
    return { body: record.audio, contentType: record.contentType, effectId: record.effectId };
  }

  function getCueAudio(effectId) {
    const record = records.get(normalizeEffectId(effectId));
    if (!record || record.status !== 'ready' || !record.cue?.filePath) return null;
    try {
      return {
        body: io.readFileSync(record.cue.filePath),
        contentType: 'audio/mpeg',
        effectId: record.effectId
      };
    } catch (_) {
      return null;
    }
  }

  function getNextPlayback() {
    const timestamp = now();
    const record = [...records.values()]
      .filter((candidate) => candidate.status === 'ready' && Buffer.isBuffer(candidate.audio))
      .filter((candidate) => candidate.playback?.status !== 'completed')
      .filter((candidate) => candidate.playback?.status !== 'claimed' || Number(candidate.playback?.leaseUntil || 0) <= timestamp)
      .sort((left, right) => left.createdAt - right.createdAt)[0];
    return publicRecord(record);
  }

  async function wait(effectId) {
    const record = records.get(normalizeEffectId(effectId));
    if (!record) return null;
    if (record.promise) await record.promise;
    return publicRecord(record);
  }

  function waitForPlayback(effectId, options = {}) {
    const normalizedEffectId = normalizeEffectId(effectId);
    const record = records.get(normalizedEffectId);
    if (!record) return Promise.resolve({ status: 'missing', completed: false, job: null });
    if (record.status === 'failed') return Promise.resolve({ status: 'failed', completed: false, job: publicRecord(record) });
    if (record.playback?.status === 'completed') {
      return Promise.resolve({ status: 'completed', completed: true, job: publicRecord(record) });
    }
    const timeoutMs = Math.max(1000, Math.min(180000, Number(options.timeoutMs) || 120000));
    return new Promise((resolve) => {
      const waiter = {
        resolve,
        timer: setTimeout(() => {
          const current = playbackWaiters.get(normalizedEffectId) || [];
          playbackWaiters.set(normalizedEffectId, current.filter((candidate) => candidate !== waiter));
          resolve({ status: 'timeout', completed: false, job: publicRecord(records.get(normalizedEffectId)) });
        }, timeoutMs)
      };
      const current = playbackWaiters.get(normalizedEffectId) || [];
      current.push(waiter);
      playbackWaiters.set(normalizedEffectId, current);
    });
  }

  function claimPlayback(value = {}) {
    const effectId = normalizeEffectId(value.effectId);
    const clientId = String(value.clientId || '').trim().slice(0, 160);
    if (!clientId) throw voiceError('invalid_client_id', 400, 'Playback-Client-ID fehlt.');
    const record = records.get(effectId);
    if (!record) throw voiceError('voice_job_not_found', 404, 'Voice-Effekt wurde nicht gefunden.');
    if (record.status !== 'ready') return { claimed: false, reason: record.status, job: publicRecord(record) };
    const timestamp = now();
    if (record.playback.status === 'completed') return { claimed: false, reason: 'completed', job: publicRecord(record) };
    if (record.playback.status === 'claimed' && record.playback.leaseUntil > timestamp && record.playback.ownerClientId !== clientId) {
      return { claimed: false, reason: 'owned', job: publicRecord(record) };
    }
    const requestedLease = Number(value.leaseMs) || DEFAULT_PLAYBACK_LEASE_MS;
    const leaseMs = Math.max(5000, Math.min(120000, requestedLease));
    record.playback = { status: 'claimed', ownerClientId: clientId, leaseUntil: timestamp + leaseMs, completedAt: 0 };
    record.updatedAt = timestamp;
    return { claimed: true, reason: '', job: publicRecord(record) };
  }

  function releasePlayback(value = {}) {
    const effectId = normalizeEffectId(value.effectId);
    const clientId = String(value.clientId || '').trim().slice(0, 160);
    const record = records.get(effectId);
    if (!record) throw voiceError('voice_job_not_found', 404, 'Voice-Effekt wurde nicht gefunden.');
    if (!clientId || record.playback?.ownerClientId !== clientId) {
      throw voiceError('playback_owner_mismatch', 409, 'Dieser Client besitzt die Playback-Lease nicht.');
    }
    const timestamp = now();
    const completed = value.completed === true;
    record.playback = completed
      ? { status: 'completed', ownerClientId: clientId, leaseUntil: 0, completedAt: timestamp }
      : { status: 'available', ownerClientId: '', leaseUntil: 0, completedAt: 0 };
    record.updatedAt = timestamp;
    const result = { released: true, completed, job: publicRecord(record) };
    persist();
    settlePlaybackWaiters(effectId, { status: completed ? 'completed' : 'released', completed, job: result.job });
    return result;
  }

  function publicState() {
    const jobs = [...records.values()];
    return {
      configured,
      provider,
      pending: jobs.filter((record) => record.status === 'pending').length,
      activeProviderJobs,
      queuedProviderJobs: providerQueue.length,
      ready: jobs.filter((record) => record.status === 'ready').length,
      failed: jobs.filter((record) => record.status === 'failed').length,
      cachedAudioBytes: totalAudioBytes
    };
  }

  return Object.freeze({
    cancel,
    claimPlayback,
    get,
    getAudio,
    getCueAudio,
    getNextPlayback,
    publicState,
    releasePlayback,
    request,
    wait,
    waitForPlayback
  });
}

module.exports = {
  DEFAULT_MAX_NEW_JOBS_PER_MINUTE,
  DEFAULT_MAX_PENDING_JOBS,
  DEFAULT_MAX_PROVIDER_CONCURRENCY,
  DEFAULT_PLAYBACK_LEASE_MS,
  createTrackerVoiceService,
  normalizeVoiceProvider,
  normalizeVoiceRequest,
  pcmToWav
};
