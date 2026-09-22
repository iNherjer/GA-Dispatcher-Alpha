'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const boardingVoiceCore = require('../mission-boarding-voice-core.js');
const warningCore = require('../navigation-warning-core.js');

const VOICE_PROVIDERS = new Set(['gemini', 'openai']);
const EFFECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const DEFAULT_MAX_ENTRIES = 64;
const DEFAULT_MAX_AUDIO_BYTES = 48 * 1024 * 1024;
const DEFAULT_PLAYBACK_LEASE_MS = 30000;
const DEFAULT_PLAYBACK_JOB_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_PENDING_JOBS = 16;
const DEFAULT_MAX_PROVIDER_CONCURRENCY = 2;
const DEFAULT_MAX_NEW_JOBS_PER_MINUTE = 60;
const STATIC_SURVEY_CLIP_KEYS = new Set(['scan_survey_area_entered', 'orbit_survey_area_entered',
  'line_complete', 'orbit_turn_complete', 'scan_survey_complete', 'orbit_survey_complete']);
const CUE_SEQUENCE_LIMITS = Object.freeze({ before: 5, after: 2, delayMs: 60000 });

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
  if (text.length > 4000 || fallbackText.length > 4000 || prompt.length > 24000 || (!text && !fallbackText && !prompt && value.kind !== 'cargo')) {
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
  const kind = ['poi', 'boarding', 'farewell', 'approach', 'cargo', 'comfort', 'wrong_start', 'off_destination', 'landing_roll', 'cargo_event', 'route_story'].includes(requestedKind) ? requestedKind : 'direct';
  const taskDomain = String(value.taskDomain || normalizedSpeaker.taskDomain || '').trim().toLowerCase().slice(0, 120);
  const cueSource = value.cue && typeof value.cue === 'object' && !Array.isArray(value.cue) ? value.cue : {};
  const requestedCueId = boardingVoiceCore.normalizeCueId(cueSource.id);
  const cueId = kind === 'boarding' || kind === 'farewell' || kind === 'cargo'
    ? requestedCueId
    // Mapping overrides are already normalized to an ID. Asset lookup remains
    // directory-local and only succeeds for a packaged cue filename.
    : (kind === 'poi' && taskDomain === 'mapping_survey' ? requestedCueId : 'none');
  const requestedStaticClipKey = String(value.staticClipKey || '').trim();
  const staticClipKey = kind === 'poi' && taskDomain === 'mapping_survey' && STATIC_SURVEY_CLIP_KEYS.has(requestedStaticClipKey)
    ? requestedStaticClipKey : '';
  const normalizeCueSequence = (raw) => {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const normalizeStage = (stage) => {
      const entries = source[stage] == null ? [] : source[stage];
      if (!Array.isArray(entries) || entries.length > CUE_SEQUENCE_LIMITS[stage]) {
        throw voiceError('invalid_cue_sequence', 400, 'Ungueltige Anzahl Audio-Cues.');
      }
      return entries.map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw voiceError('invalid_cue_sequence', 400, 'Ungueltiger Audio-Cue.');
        const id = boardingVoiceCore.normalizeCueId(entry.id);
        const delayMs = Number(entry.delayMs || 0);
        if (id === 'none' || !Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > CUE_SEQUENCE_LIMITS.delayMs) {
          throw voiceError('invalid_cue_sequence', 400, 'Ungueltiger Audio-Cue.');
        }
        return {
          id,
          variantSeed: String(entry.variantSeed || '').trim().slice(0, 500),
          gain: Math.max(0, Math.min(1, Number(entry.gain) || 0.38)),
          delayMs
        };
      });
    };
    return { before: normalizeStage('before'), after: normalizeStage('after') };
  };
  return {
    effectId,
    text,
    prompt,
    fallbackText,
    kind,
    deferPlayback: value.deferPlayback === true,
    synthesizeAudio: kind !== 'cargo' && value.synthesizeAudio !== false,
    taskDomain,
    staticClipKey,
    gender: normalizedSpeaker.gender,
    voiceName,
    speaker: normalizedSpeaker,
    cue: {
      id: cueId,
      variantSeed: cueId === 'none' ? '' : String(cueSource.variantSeed || '').trim().slice(0, 500),
      gain: cueId === 'none' ? 0 : Math.max(0, Math.min(1, Number(cueSource.gain) || 0.38))
    },
    cueSequence: normalizeCueSequence(value.cueSequence),
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
        body: JSON.stringify({ model, voice: voiceName, input: request.text, ...(boardingVoiceCore.conversationalTtsStyle(request.speaker) ? { instructions: boardingVoiceCore.conversationalTtsStyle(request.speaker) } : {}), response_format: 'mp3' })
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
          contents: [{ role: 'user', parts: [{ text: boardingVoiceCore.ttsInput(request.text, request.speaker) }] }],
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
  const audioControl = options.audioControl || null;
  const provider = normalizeVoiceProvider(options.provider);
  const apiKey = String(options.apiKey || '').trim();
  const fetchRemote = typeof options.fetchRemote === 'function' ? options.fetchRemote : globalThis.fetch;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const maxEntries = Math.max(4, Math.min(256, Number(options.maxEntries) || DEFAULT_MAX_ENTRIES));
  const maxAudioBytes = Math.max(1024 * 1024, Number(options.maxAudioBytes) || DEFAULT_MAX_AUDIO_BYTES);
  const maxPendingJobs = Math.max(1, Math.min(64, Number(options.maxPendingJobs) || DEFAULT_MAX_PENDING_JOBS));
  const maxProviderConcurrency = Math.max(1, Math.min(4, Number(options.maxProviderConcurrency) || DEFAULT_MAX_PROVIDER_CONCURRENCY));
  const playbackJobTtlMs = Math.max(60000, Math.min(24 * 60 * 60 * 1000,
    Number(options.playbackJobTtlMs) || DEFAULT_PLAYBACK_JOB_TTL_MS));
  const storageFile = String(options.storageFile || '').trim();
  const audioCueDirectory = options.audioCueDirectory === false
    ? ''
    : path.resolve(String(options.audioCueDirectory || path.join(__dirname, '..', 'audio-cues')));
  const io = options.io && typeof options.io === 'object' ? options.io : fs;
  const staticSurveyCatalogPath = path.resolve(String(options.staticSurveyCatalogPath || path.join(__dirname, '..', 'audio-pax', 'gemini-survey-v1', 'catalog.json')));
  const records = new Map();
  const playbackClients = new Map();
  const playbackGuards = new Map();
  function checkPlaybackGuard(effectId) {
    if (!records.has(effectId)) { playbackGuards.delete(effectId); return true; }
    const guard = playbackGuards.get(effectId);
    if (guard && !guard()) { cancel(effectId, 'mission_end'); return false; }
    return true;
  }
  const providerQueue = [];
  const newJobTimestamps = [];
  const playbackWaiters = new Map();
  const playbackClaimWaiters = new Map();
  let totalAudioBytes = 0;
  let activeProviderJobs = 0;

  const configured = Boolean(apiKey && typeof fetchRemote === 'function');
  const supportsStaticSurvey = request => request?.kind === 'poi' && request?.taskDomain === 'mapping_survey'
    && STATIC_SURVEY_CLIP_KEYS.has(String(request?.staticClipKey || ''));

  async function resolveStaticSurveyAudio(request) {
    if (!supportsStaticSurvey(request) || request.synthesizeAudio === false) return null;
    try {
      const catalog = JSON.parse(await (io.promises?.readFile || fs.promises.readFile)(staticSurveyCatalogPath, 'utf8'));
      const takes = Array.isArray(catalog?.clips?.[request.staticClipKey]?.takes) ? catalog.clips[request.staticClipKey].takes : [];
      const candidates = boardingVoiceCore.voiceCandidates('gemini', request.speaker, request.voiceName);
      const take = candidates.map(voice => takes.find(entry => String(entry?.voice || '').toLowerCase() === String(voice).toLowerCase()))
        .find(Boolean);
      const rel = String(take?.path || '').replace(/\\/g, '/');
      if (!take || !/^clips\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.wav$/.test(rel)) return null;
      const filePath = path.resolve(path.dirname(staticSurveyCatalogPath), rel);
      if (!filePath.startsWith(path.dirname(staticSurveyCatalogPath) + path.sep)) return null;
      const audio = Buffer.from(await (io.promises?.readFile || fs.promises.readFile)(filePath));
      return audio.length ? { audio, contentType: String(take.mimeType || 'audio/wav'), voiceName: String(take.voice || ''), model: 'static-survey' } : null;
    } catch (_) { return null; }
  }

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
      ...(record.clips ? { clips: [...record.clips], expiresAt: record.expiresAt } : {}),
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
        assetName: record.cue?.assetName || '',
        audioAvailable: Boolean(record.cue?.filePath),
        gain: Number(record.cue?.gain) || 0
      },
      cueSequence: {
        before: (record.cueSequence?.before || []).map(cue => ({ id: cue.id, assetName: cue.assetName || '', audioAvailable: Boolean(cue.filePath), gain: Number(cue.gain) || 0, delayMs: Number(cue.delayMs) || 0 })),
        after: (record.cueSequence?.after || []).map(cue => ({ id: cue.id, assetName: cue.assetName || '', audioAvailable: Boolean(cue.filePath), gain: Number(cue.gain) || 0, delayMs: Number(cue.delayMs) || 0 }))
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
        position: playback.position ? { ...playback.position } : { stage: 'cue', offset: 0 },
        leaseUntil: Number(playback.leaseUntil) || null,
        completedAt: Number(playback.completedAt) || null
      }
    };
  }

  function evict() {
    if (records.size <= maxEntries && totalAudioBytes <= maxAudioBytes) return;
    const candidates = [...records.values()]
      .filter((record) => !['pending', 'text_blocked'].includes(record.status) && record.playback?.status !== 'claimed')
      .sort((left, right) => left.updatedAt - right.updatedAt);
    for (const record of candidates) {
      if (records.size <= maxEntries && totalAudioBytes <= maxAudioBytes) break;
      records.delete(record.effectId);
      totalAudioBytes -= Number(record.audio?.length) || 0;
    }
  }

  // Immutable audio blobs are written once; small metadata is replaced atomically.
  // Legacy v1 inline-audio files are still readable and migrate on the next save.
  const audioDirectory = storageFile + '.audio';
  const audioHashes = new WeakMap();
  const writtenAudio = new Set();
  let cacheDirectoryReady = false, prunedAudioSignature = null;
  let persistenceDirty = false;
  let persistencePromise = null;
  async function writeCache() {
    const temporaryFile = `${storageFile}.tmp`;
    let file;
    try {
      const rows = [...records.values()]
        .filter(record => !record.clips && record.status === 'ready' && (Buffer.isBuffer(record.audio) || record.synthesizeAudio === false))
        .map(record => {
          if (Buffer.isBuffer(record.audio) && !audioHashes.has(record.audio)) {
            audioHashes.set(record.audio, crypto.createHash('sha256').update(record.audio).digest('hex'));
          }
          const metadata = {
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
            cueSequence: Object.fromEntries(['before', 'after'].map(stage => [stage, (record.cueSequence?.[stage] || []).map(cue => ({
              id: cue.id, variantSeed: cue.variantSeed, gain: cue.gain, delayMs: cue.delayMs, assetName: cue.assetName
            }))])),
            status: 'ready',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            text: record.text || '',
            textModel: record.textModel || '',
            contentType: record.contentType || '',
            model: record.model || '',
            voiceName: record.voiceName || '',
            playback: record.playback
          };
          return { metadata: JSON.parse(JSON.stringify(metadata)), audio: record.audio, audioHash: record.audio ? audioHashes.get(record.audio) : null };
        });
      if (!cacheDirectoryReady) {
        await io.promises.mkdir(audioDirectory, { recursive: true });
        cacheDirectoryReady = true;
      }
      for (const row of rows) {
        if (!row.audioHash || writtenAudio.has(row.audioHash)) continue;
        const filename = path.join(audioDirectory, row.audioHash + '.audio');
        await io.promises.writeFile(filename + '.tmp', row.audio, { mode: 0o600 });
        await io.promises.rename(filename + '.tmp', filename);
        writtenAudio.add(row.audioHash);
      }
      file = await io.promises.open(temporaryFile, 'w', 0o600);
      await file.writeFile(JSON.stringify({ schema: 'ga.tracker-voice-cache.v2',
        records: rows.map(row => ({ ...row.metadata, audioHash: row.audioHash })) }));
      await file.close();
      file = null;
      await io.promises.rename(temporaryFile, storageFile);
      // Only prune after the new index is committed. Failed index writes must
      // preserve all blobs referenced by the previous recovery state.
      const retained = new Set(rows.map(row => row.audioHash).filter(Boolean));
      const audioSignature = [...retained].sort().join(',');
      try {
        if (audioSignature !== prunedAudioSignature) for (const name of await io.promises.readdir(audioDirectory)) {
          if (!/^[a-f0-9]{64}\.audio$/.test(name) || retained.has(name.slice(0, -6))) continue;
          await io.promises.unlink(path.join(audioDirectory, name));
          writtenAudio.delete(name.slice(0, -6));
        }
        prunedAudioSignature = audioSignature;
      } catch (error) { log(`VOICE_CACHE_PRUNE_ERROR code=${error?.code || error?.message || error}`); }
      return true;
    } catch (error) {
      cacheDirectoryReady = false;
      if (error?.code === 'ENOENT') writtenAudio.clear();
      log(`VOICE_CACHE_WRITE_ERROR code=${error?.code || error?.message || error}`);
      return false;
    } finally {
      if (file) await file.close().catch(() => {});
    }
  }

  function persist() {
    if (!storageFile) return true;
    persistenceDirty = true;
    if (!persistencePromise) {
      persistencePromise = new Promise(resolve => setImmediate(resolve)).then(async () => {
        while (persistenceDirty) {
          persistenceDirty = false;
          if (!await writeCache()) {
            persistenceDirty = true; // A later mutation/flush may retry; no busy loop.
            return false;
          }
        }
        return true;
      }).finally(() => { persistencePromise = null; });
    }
    return true;
  }

  async function flushPersistence() {
    if (persistenceDirty && !persistencePromise) persist();
    return persistencePromise ? await persistencePromise : true;
  }

  function loadPersisted() {
    if (!storageFile || !io.existsSync(storageFile)) return;
    try {
      const parsed = JSON.parse(io.readFileSync(storageFile, 'utf8'));
      if (!['ga.tracker-voice-cache.v1', 'ga.tracker-voice-cache.v2'].includes(parsed?.schema) || !Array.isArray(parsed.records)) return;
      for (const source of parsed.records.slice(-maxEntries)) {
        const effectId = normalizeEffectId(source?.effectId);
        let audio;
        if (parsed.schema === 'ga.tracker-voice-cache.v2') {
          const hash = String(source?.audioHash || '');
          if (hash && !/^[a-f0-9]{64}$/.test(hash)) { log('VOICE_CACHE_AUDIO_INVALID_HASH'); continue; }
          try {
            audio = hash ? io.readFileSync(path.join(audioDirectory, hash + '.audio')) : Buffer.alloc(0);
            if (hash && crypto.createHash('sha256').update(audio).digest('hex') !== hash) throw Error('audio_hash_mismatch');
            if (hash) { audioHashes.set(audio, hash); writtenAudio.add(hash); }
          } catch (error) { log(`VOICE_CACHE_AUDIO_READ_ERROR code=${error?.code || error?.message || error}`); continue; }
        } else audio = Buffer.from(String(source?.audioBase64 || ''), 'base64');
        const synthesizeAudio = source?.synthesizeAudio !== false;
        if ((synthesizeAudio && !audio.length) || totalAudioBytes + audio.length > maxAudioBytes) continue;
        const timestamp = Math.max(0, Number(source.updatedAt) || Number(source.createdAt) || now());
        const playback = source.playback && typeof source.playback === 'object' ? source.playback : {};
        const createdAt = Math.max(0, Number(source.createdAt) || timestamp);
        if (playback.status !== 'completed' && playback.status !== 'deferred'
            && now() - createdAt > playbackJobTtlMs) continue;
        const cue = resolveAudioCue(source.cue);
        const cueSequence = Object.fromEntries(['before', 'after'].map(stage => [stage,
          (Array.isArray(source.cueSequence?.[stage]) ? source.cueSequence[stage].slice(0, CUE_SEQUENCE_LIMITS[stage]) : [])
            .map(entry => ({ ...entry, ...resolveAudioCue(entry), delayMs: Math.max(0, Math.min(CUE_SEQUENCE_LIMITS.delayMs, Number(entry?.delayMs) || 0)) }))
        ]));
        const record = {
          effectId,
          fingerprint: String(source.fingerprint || ''),
          kind: ['poi', 'boarding', 'farewell', 'approach', 'cargo', 'comfort', 'wrong_start', 'off_destination', 'landing_roll', 'cargo_event', 'route_story'].includes(String(source.kind || '').trim().toLowerCase())
            ? String(source.kind || '').trim().toLowerCase()
            : 'direct',
          synthesizeAudio,
          provider: normalizeVoiceProvider(source.provider),
          speaker: boardingVoiceCore.normalizeSpeaker(source.speaker),
          cue,
          cueSequence,
          status: 'ready',
          createdAt,
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
            : (playback.status === 'deferred'
              ? { status: 'deferred', ownerClientId: '', leaseUntil: 0, completedAt: 0 }
              : { status: playback.status === 'released' ? 'released' : 'available', ownerClientId: '', leaseUntil: 0, completedAt: 0, position: normalizePlaybackPosition(playback.position) }),
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

  function settlePlaybackClaimWaiters(effectId, result) {
    const waiters = playbackClaimWaiters.get(effectId) || [];
    playbackClaimWaiters.delete(effectId);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(result);
    }
  }

  loadPersisted();

  async function produce(record, request) {
    try {
      const resolvedText = request.kind === 'poi' && record.textReady
        ? { text: record.text, textModel: record.textModel }
        : request.kind === 'cargo' ? { text: '', textModel: '' }
        : await resolveRequestText({ provider, apiKey, request, fetchRemote });
      if (record.cancelled === true) return publicRecord(record);
      request = { ...request, text: resolvedText.text };
      record.text = resolvedText.text;
      record.textModel = resolvedText.textModel;
      if (request.kind === 'poi' && typeof request.confirmTextReady === 'function') {
        // The mission owns this durable text checkpoint, before any audio work.
        // A failed commit retains the exact generated text for a later retry.
        record.textReady = true;
        let confirmation;
        try { confirmation = await request.confirmTextReady(record.text); }
        catch (error) { confirmation = { ok: false, error: error?.message || 'poi_text_commit_failed' }; }
        if (confirmation?.ok !== true) {
          record.status = 'text_blocked';
          record.error = confirmation?.error || 'poi_text_commit_failed';
          record.updatedAt = now();
          return publicRecord(record);
        }
        if (record.cancelled === true) return publicRecord(record);
        record.error = '';
      }
      if (request.synthesizeAudio === false) {
        record.status = 'ready';
        record.updatedAt = now();
        log(`VOICE_TEXT_READY effectId=${record.effectId} provider=${provider} model=${record.textModel || 'fallback'}`);
        persist();
        return publicRecord(record);
      }
      const staticAudio = await resolveStaticSurveyAudio(request);
      if (staticAudio) {
        record.audio = staticAudio.audio; record.contentType = staticAudio.contentType;
        record.model = staticAudio.model; record.voiceName = staticAudio.voiceName;
        record.status = 'ready'; record.updatedAt = now(); totalAudioBytes += staticAudio.audio.length;
        log(`VOICE_STATIC_SURVEY_READY effectId=${record.effectId} clip=${request.staticClipKey}`); evict(); persist();
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
      settlePlaybackClaimWaiters(record.effectId, { status: 'failed', claimed: false, job: publicRecord(record) });
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
    if (typeof rawRequest?.isPlaybackAllowed === 'function') playbackGuards.set(normalizeEffectId(rawRequest.effectId), rawRequest.isPlaybackAllowed);
    const request = normalizeVoiceRequest(rawRequest);
    // Process-local authority hooks and already committed recovery text do not
    // alter the immutable prompt fingerprint. Only the POI dispatcher uses them.
    if (request.kind === 'poi' && typeof rawRequest.confirmTextReady === 'function') {
      request.confirmTextReady = rawRequest.confirmTextReady;
      request.resolvedText = String(rawRequest.resolvedText || '').trim().slice(0, 4000);
    }
    const fingerprint = crypto.createHash('sha256')
      .update(JSON.stringify({
        provider,
        text: request.text,
        prompt: request.prompt,
        fallbackText: request.fallbackText,
        kind: request.kind,
        synthesizeAudio: request.synthesizeAudio,
        taskDomain: request.taskDomain,
        staticClipKey: request.staticClipKey,
        speaker: request.speaker,
        cue: request.cue,
        ...((request.cueSequence.before.length || request.cueSequence.after.length) ? { cueSequence: request.cueSequence } : {}),
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
      if (existing.status === 'text_blocked' && !existing.promise && request.confirmTextReady) {
        existing.status = 'pending';
        schedule(existing, request);
      }
      return publicRecord(existing);
    }
    if (!configured && request.kind !== 'cargo' && !supportsStaticSurvey(request)) throw voiceError('voice_not_configured', 503, 'Zentrale Voice-Ausgabe ist im Tracker nicht konfiguriert.');
    const timestamp = now();
    while (newJobTimestamps.length && timestamp - newJobTimestamps[0] >= 60000) newJobTimestamps.shift();
    if (newJobTimestamps.length >= DEFAULT_MAX_NEW_JOBS_PER_MINUTE) {
      throw voiceError('voice_rate_limited', 429, 'Zu viele neue Voice-Auftraege in kurzer Zeit.');
    }
    const pendingJobs = [...records.values()].filter((record) => ['pending', 'text_blocked'].includes(record.status)).length;
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
      cueSequence: Object.fromEntries(['before', 'after'].map(stage => [stage, request.cueSequence[stage].map(entry => ({ ...entry, ...resolveAudioCue(entry), delayMs: entry.delayMs }))])),
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      text: request.resolvedText || request.text,
      textReady: Boolean(request.resolvedText),
      textModel: '',
      audio: null,
      contentType: '',
      model: '',
      voiceName: request.voiceName,
      error: '',
      playback: { status: request.deferPlayback ? 'deferred' : 'available', ownerClientId: '', leaseUntil: 0, completedAt: 0 },
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
    playbackGuards.delete(normalizedEffectId);
    if (Buffer.isBuffer(record.audio)) totalAudioBytes = Math.max(0, totalAudioBytes - record.audio.length);
    record.cancelled = true;
    record.status = 'cancelled';
    record.error = String(reason || 'voice_cancelled').trim().slice(0, 180);
    record.updatedAt = now();
    settlePlaybackWaiters(normalizedEffectId, { status: 'cancelled', completed: false, job: publicRecord(record) });
    settlePlaybackClaimWaiters(normalizedEffectId, { status: 'cancelled', claimed: false, job: publicRecord(record) });
    if (!record.clips) persist();
    return { cancelled: true, reason: record.error, job: publicRecord(record) };
  }

  function getAudio(effectId) {
    const record = records.get(normalizeEffectId(effectId));
    if (!record || record.status !== 'ready' || !Buffer.isBuffer(record.audio)) return null;
    return { body: record.audio, contentType: record.contentType, effectId: record.effectId };
  }

  function getCueAudio(effectId, index = null, stage = '') {
    const record = records.get(normalizeEffectId(effectId));
    const sequenceStage = stage === 'before' || stage === 'after' ? stage : '';
    const cue = sequenceStage && Number.isSafeInteger(Number(index))
      ? record?.cueSequence?.[sequenceStage]?.[Number(index)]
      : record?.cue;
    if (!record || record.status !== 'ready' || !cue?.filePath) return null;
    try {
      return {
        body: io.readFileSync(cue.filePath),
        contentType: 'audio/mpeg',
        effectId: record.effectId
      };
    } catch (_) {
      return null;
    }
  }

  function enqueueWarning(value) {
    const effectId = normalizeEffectId(value.effectId);
    if (!['airspace', 'terrain', 'waypoint'].includes(value.kind) || !Array.isArray(value.clips)
        || !value.clips.length || value.clips.length > 64) throw new Error('invalid_navigation_warning');
    for (const key of value.clips) if (key !== 'taws-whoop') warningCore.assetPath(key);
    if (records.has(effectId)) return publicRecord(records.get(effectId));
    const timestamp = now();
    const record = { effectId, kind: value.kind, clips: [...value.clips], text: String(value.text || '').slice(0, 240),
      status: 'ready', synthesizeAudio: false, provider: 'static', speaker: {}, createdAt: timestamp, updatedAt: timestamp,
      expiresAt: Math.min(timestamp + 120000, Number(value.expiresAt) || timestamp + 60000),
      playback: { status: 'available', ownerClientId: '', leaseUntil: 0, position: { stage: 'warning:0', offset: 0 } } };
    records.set(effectId, record); evict();
    return publicRecord(record);
  }
  function getNextPlayback(clientId = '', deviceId = '') {
    if (audioControl && audioControl.snapshot().target.deviceId !== deviceId) return null;
    reconcileAudioSettings();
    const timestamp = now();
    for (const [id, seenAt] of playbackClients) if (timestamp - seenAt > 6000) playbackClients.delete(id);
    if (clientId) playbackClients.set(String(clientId).slice(0, 160), timestamp);
    if (playbackClients.size > 32) playbackClients.delete(playbackClients.keys().next().value);
    for (const id of playbackGuards.keys()) checkPlaybackGuard(id);
    if ([...records.values()].some(record => record.playback?.status === 'claimed' && record.playback.leaseUntil > timestamp)) return null;
    let pruned = false;
    for (const candidate of records.values()) {
      const playbackStatus = String(candidate.playback?.status || 'available');
      if (candidate.status !== 'ready' || playbackStatus === 'completed' || playbackStatus === 'deferred') continue;
      if (candidate.clips ? timestamp <= candidate.expiresAt : timestamp - Number(candidate.createdAt || timestamp) <= playbackJobTtlMs) continue;
      records.delete(candidate.effectId);
      totalAudioBytes = Math.max(0, totalAudioBytes - (Number(candidate.audio?.length) || 0));
      settlePlaybackWaiters(candidate.effectId, { status: 'expired', completed: false, job: publicRecord(candidate) });
      settlePlaybackClaimWaiters(candidate.effectId, { status: 'expired', claimed: false, job: publicRecord(candidate) });
      log(`VOICE_PLAYBACK_EXPIRED effectId=${candidate.effectId}`);
      if (!candidate.clips) pruned = true;
    }
    if (pruned) persist();
    const record = [...records.values()]
      .filter((candidate) => candidate.status === 'ready' && (candidate.clips || Buffer.isBuffer(candidate.audio) || ((audioControl || candidate.kind === 'cargo') && (candidate.cue?.filePath || candidate.cueSequence?.before?.some(cue => cue.filePath) || candidate.cueSequence?.after?.some(cue => cue.filePath)))))
      .filter((candidate) => !clientId || !(candidate.failedPlaybackClients || []).includes(clientId))
      .filter((candidate) => candidate.playback?.status !== 'deferred')
      .filter((candidate) => candidate.playback?.status !== 'completed' && candidate.playback?.status !== 'released')
      .filter((candidate) => candidate.playback?.status !== 'claimed' || Number(candidate.playback?.leaseUntil || 0) <= timestamp)
      .sort((left, right) => Number(!!left.clips) - Number(!!right.clips) || left.createdAt - right.createdAt)[0];
    return publicRecord(record);
  }

  function activatePlayback(effectId) {
    const normalizedEffectId = normalizeEffectId(effectId);
    const record = records.get(normalizedEffectId);
    if (!record) return { activated: false, reason: 'missing', job: null };
    if (record.playback?.status === 'deferred') {
      record.playback = { status: 'available', ownerClientId: '', leaseUntil: 0, completedAt: 0 };
      record.updatedAt = now();
      persist();
    }
    return { activated: true, reason: '', job: publicRecord(record) };
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
    if (record.playback?.status === 'released') {
      return Promise.resolve({ status: 'released', completed: false, job: publicRecord(record) });
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

  function waitForPlaybackClaim(effectId, options = {}) {
    const normalizedEffectId = normalizeEffectId(effectId);
    const record = records.get(normalizedEffectId);
    if (!record) return Promise.resolve({ status: 'missing', claimed: false, job: null });
    if (record.status === 'failed') return Promise.resolve({ status: 'failed', claimed: false, job: publicRecord(record) });
    if (record.playback?.status === 'completed') {
      return Promise.resolve({ status: 'completed', claimed: true, job: publicRecord(record) });
    }
    if (record.playback?.status === 'released') {
      return Promise.resolve({ status: 'released', claimed: true, job: publicRecord(record) });
    }
    if (record.playback?.status === 'claimed' && Number(record.playback?.leaseUntil || 0) > now()) {
      return Promise.resolve({ status: 'claimed', claimed: true, job: publicRecord(record) });
    }
    const timeoutMs = Math.max(250, Math.min(30000, Number(options.timeoutMs) || 5000));
    const startedWaitingAt = now();
    return new Promise((resolve) => {
      const waiter = {
        resolve,
        timer: null
      };
      const expire = () => {
          // Waiting behind another player is not an unclaimed-audio failure.
          if (now() - startedWaitingAt < 180000 && [...records.values()].some(other => other.effectId !== normalizedEffectId
              && other.playback?.status === 'claimed' && other.playback.leaseUntil > now())) {
            waiter.timer = setTimeout(expire, timeoutMs);
            return;
          }
          const current = playbackClaimWaiters.get(normalizedEffectId) || [];
          playbackClaimWaiters.set(normalizedEffectId, current.filter((candidate) => candidate !== waiter));
          resolve({ status: 'timeout', claimed: false, job: publicRecord(records.get(normalizedEffectId)) });
      };
      waiter.timer = setTimeout(expire, timeoutMs);
      const current = playbackClaimWaiters.get(normalizedEffectId) || [];
      current.push(waiter);
      playbackClaimWaiters.set(normalizedEffectId, current);
    });
  }

  function claimPlayback(value = {}) {
    const effectId = normalizeEffectId(value.effectId);
    if (!checkPlaybackGuard(effectId)) return { claimed: false, reason: 'mission_end', job: null };
    const clientId = String(value.clientId || '').trim().slice(0, 160);
    if (!clientId) throw voiceError('invalid_client_id', 400, 'Playback-Client-ID fehlt.');
    const record = records.get(effectId);
    if (!record) throw voiceError('voice_job_not_found', 404, 'Voice-Effekt wurde nicht gefunden.');
    if (audioControl && !audioControl.canPlay(String(value.deviceId || ''), record)) return { claimed: false, reason: 'audio_device_not_selected', job: null };
    if ((record.failedPlaybackClients || []).includes(clientId)) return { claimed: false, reason: 'client_playback_failed', job: publicRecord(record) };
    if (record.clips && record.expiresAt < now()) return { claimed: false, reason: 'expired', job: null };
    if (record.status !== 'ready') return { claimed: false, reason: record.status, job: publicRecord(record) };
    const timestamp = now();
    if ([...records.values()].some(other => other.effectId !== effectId && other.playback?.status === 'claimed' && other.playback.leaseUntil > timestamp)) {
      return { claimed: false, reason: 'playback_busy', job: publicRecord(record) };
    }
    if (record.playback.status === 'deferred') return { claimed: false, reason: 'deferred', job: publicRecord(record) };
    if (record.playback.status === 'completed' || record.playback.status === 'released') return { claimed: false, reason: record.playback.status, job: publicRecord(record) };
    if (record.playback.status === 'claimed' && record.playback.leaseUntil > timestamp && record.playback.ownerClientId !== clientId) {
      return { claimed: false, reason: 'owned', job: publicRecord(record) };
    }
    const requestedLease = Number(value.leaseMs) || DEFAULT_PLAYBACK_LEASE_MS;
    const leaseMs = Math.max(5000, Math.min(120000, requestedLease));
    record.playback = { status: 'claimed', ownerClientId: clientId, deviceId: String(value.deviceId || ''),
      position: record.playback.position || { stage: 'cue', offset: 0 }, leaseUntil: timestamp + leaseMs, completedAt: 0 };
    record.updatedAt = timestamp;
    const result = { claimed: true, reason: '', job: publicRecord(record) };
    settlePlaybackClaimWaiters(effectId, { status: 'claimed', claimed: true, job: result.job });
    return result;
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
    const retryable = !completed && value.retryable === true;
    if (!completed && value.error) log(`VOICE_PLAYBACK_FAILED effectId=${effectId} reason=${String(value.error).replace(/[\r\n]/g, ' ').slice(0, 160)}`);
    if (retryable && value.deviceSwitch !== true) record.failedPlaybackClients = [...new Set([...(record.failedPlaybackClients || []), clientId])].slice(-32);
    if (!retryable) playbackGuards.delete(effectId);
    const position = normalizePlaybackPosition(value.position || record.playback.position);
    record.playback = completed
      ? { status: 'completed', ownerClientId: clientId, leaseUntil: 0, completedAt: timestamp }
      : { status: retryable ? 'available' : 'released', ownerClientId: '', leaseUntil: 0, completedAt: 0, position };
    record.updatedAt = timestamp;
    const result = { released: true, completed, job: publicRecord(record) };
    if (!record.clips) persist();
    if (!retryable) settlePlaybackWaiters(effectId, { status: completed ? 'completed' : 'released', completed, job: result.job });
    if (completed) settlePlaybackClaimWaiters(effectId, { status: 'completed', claimed: true, job: result.job });
    return result;
  }

  function normalizePlaybackPosition(value = {}) {
    const sequence = /^(before|after):([0-7])$/.exec(String(value.stage || ''));
    const stage = /^warning:(?:[0-9]|[1-5][0-9]|6[0-3])$/.test(value.stage) ? value.stage
      : value.stage === 'audio' || value.stage === 'after:done' ? value.stage
        : sequence ? `${sequence[1]}:${sequence[2]}` : 'cue';
    return { stage, offset: Math.max(0, Math.min(180, Number(value.offset) || 0)) };
  }

  function renewPlayback(value = {}) {
    const record = records.get(String(value.effectId || ''));
    if (!record || !checkPlaybackGuard(record.effectId) || record.playback?.status !== 'claimed'
        || record.playback.ownerClientId !== value.clientId || record.playback.leaseUntil <= now()) return { continued: false, reason: 'lease_lost' };
    if (audioControl && !audioControl.canPlay(String(value.deviceId || ''), record)) return { continued: false, reason: 'device_changed' };
    record.playback.position = normalizePlaybackPosition(value.position);
    record.playback.leaseUntil = now() + 5000;
    return { continued: true, leaseUntil: record.playback.leaseUntil };
  }

  function reconcileAudioSettings() {
    if (!audioControl) return;
    const target = audioControl.snapshot().target.deviceId;
    for (const record of records.values()) {
      if (record.status !== 'ready' || !['available'].includes(record.playback?.status)
          || audioControl.canPlay(target, record)) continue;
      record.playback.status = 'released';
      settlePlaybackWaiters(record.effectId, { status: 'released', completed: false, job: publicRecord(record) });
      settlePlaybackClaimWaiters(record.effectId, { status: 'released', claimed: false, job: publicRecord(record) });
    }
  }

  function publicState() {
    reconcileAudioSettings();
    const jobs = [...records.values()];
    const playing = jobs.find(record => record.playback?.status === 'claimed' && record.playback.leaseUntil > now());
    return {
      nowPlaying: playing ? { effectId: playing.effectId, kind: playing.kind, text: playing.text, speaker: { ...playing.speaker }, provider: playing.provider, model: playing.model, voiceName: playing.voiceName } : null,
      configured,
      priorityAvailable: jobs.some(record => !record.clips && record.status === 'ready'
        && (Buffer.isBuffer(record.audio) || record.cue?.filePath || record.cueSequence?.before?.some(cue => cue.filePath) || record.cueSequence?.after?.some(cue => cue.filePath))
        && ['available', 'claimed'].includes(record.playback?.status)),
      playbackAvailable: jobs.some(record => record.status === 'ready' && ['available', 'claimed'].includes(record.playback?.status)),
      notification: crypto.createHash('sha256').update(jobs.map(record => record.effectId + ':' + record.status + ':' + (record.playback?.status === 'claimed' && record.playback.leaseUntil <= now() ? 'expired' : record.playback?.status)).join('|')).digest('hex').slice(0, 20),
      provider,
      pending: jobs.filter((record) => record.status === 'pending').length,
      activeProviderJobs,
      queuedProviderJobs: providerQueue.length,
      ready: jobs.filter((record) => record.status === 'ready').length,
      failed: jobs.filter((record) => record.status === 'failed').length,
      audioPlaybackCandidates: Math.max(
        [...playbackClients.values()].filter(seenAt => now() - seenAt <= 6000).length,
        jobs.filter(record => record.playback?.status === 'claimed' && record.playback.leaseUntil > now()).length),
      cachedAudioBytes: totalAudioBytes
    };
  }

  return Object.freeze({
    enqueueWarning,
    activatePlayback,
    cancel,
    claimPlayback,
    get,
    getAudio,
    getCueAudio,
    getNextPlayback,
    flushPersistence,
    publicState,
    releasePlayback,
    renewPlayback,
    request,
    supportsStaticSurvey,
    wait,
    waitForPlayback,
    waitForPlaybackClaim
  });
}

module.exports = {
  DEFAULT_MAX_NEW_JOBS_PER_MINUTE,
  DEFAULT_MAX_PENDING_JOBS,
  DEFAULT_MAX_PROVIDER_CONCURRENCY,
  DEFAULT_PLAYBACK_LEASE_MS,
  DEFAULT_PLAYBACK_JOB_TTL_MS,
  createTrackerVoiceService,
  normalizeVoiceProvider,
  normalizeVoiceRequest,
  pcmToWav
};
