'use strict';

const crypto = require('node:crypto');

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
  if (!text || text.length > 4000) throw voiceError('invalid_voice_text', 400, 'Voice-Text fehlt oder ist zu lang.');
  const speaker = value.speaker && typeof value.speaker === 'object' && !Array.isArray(value.speaker)
    ? value.speaker
    : {};
  const gender = /^(male|m|mann|maennlich|männlich)$/i.test(String(speaker.gender || '')) ? 'male' : 'female';
  const voiceName = String(value.voiceName || '').trim().slice(0, 80);
  return {
    effectId,
    text,
    gender,
    voiceName,
    speaker: {
      name: String(speaker.name || '').trim().slice(0, 120),
      role: String(speaker.role || '').trim().slice(0, 160),
      gender
    }
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

async function synthesizeOpenAi({ apiKey, request, fetchRemote }) {
  const voiceName = request.voiceName || (request.gender === 'male' ? 'onyx' : 'nova');
  const model = 'gpt-4o-mini-tts';
  const response = await fetchRemote('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, voice: voiceName, input: request.text, response_format: 'mp3' })
  });
  if (!response?.ok) throw voiceError('voice_provider_error', 502, `OpenAI TTS antwortete mit HTTP ${Number(response?.status) || 0}.`);
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) throw voiceError('voice_provider_empty', 502, 'OpenAI TTS lieferte keine Audiodaten.');
  return { audio, contentType: 'audio/mpeg', model, voiceName };
}

async function synthesizeGemini({ apiKey, request, fetchRemote }) {
  const voiceName = request.voiceName || (request.gender === 'male' ? 'Charon' : 'Kore');
  const model = 'gemini-3.1-flash-tts-preview';
  const response = await fetchRemote(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: request.text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
      }
    })
  });
  if (!response?.ok) throw voiceError('voice_provider_error', 502, `Gemini TTS antwortete mit HTTP ${Number(response?.status) || 0}.`);
  const data = await response.json();
  const inlineData = data?.candidates?.[0]?.content?.parts?.find?.((part) => part?.inlineData?.data)?.inlineData
    || data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  const audio = Buffer.from(String(inlineData?.data || ''), 'base64');
  if (!audio.length) throw voiceError('voice_provider_empty', 502, 'Gemini TTS lieferte keine Audiodaten.');
  return { ...normalizeGeminiAudio(audio, inlineData?.mimeType), model, voiceName };
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
  const records = new Map();
  const providerQueue = [];
  const newJobTimestamps = [];
  let totalAudioBytes = 0;
  let activeProviderJobs = 0;

  const configured = Boolean(apiKey && typeof fetchRemote === 'function');

  function publicRecord(record) {
    if (!record) return null;
    const playback = record.playback || {};
    return {
      effectId: record.effectId,
      status: record.status,
      provider: record.provider,
      model: record.model || '',
      voiceName: record.voiceName || '',
      speaker: { ...record.speaker },
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

  async function produce(record, request) {
    try {
      const result = provider === 'openai'
        ? await synthesizeOpenAi({ apiKey, request, fetchRemote })
        : await synthesizeGemini({ apiKey, request, fetchRemote });
      record.audio = result.audio;
      record.contentType = result.contentType;
      record.model = result.model;
      record.voiceName = result.voiceName;
      record.status = 'ready';
      record.updatedAt = now();
      totalAudioBytes += result.audio.length;
      log(`VOICE_TTS_READY effectId=${record.effectId} provider=${provider} model=${result.model} bytes=${result.audio.length}`);
      evict();
      return publicRecord(record);
    } catch (error) {
      record.status = 'failed';
      record.error = error?.code || 'voice_generation_failed';
      record.updatedAt = now();
      log(`VOICE_TTS_ERROR effectId=${record.effectId} provider=${provider} code=${record.error}`);
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
    if (!configured) throw voiceError('voice_not_configured', 503, 'Zentrale Voice-Ausgabe ist im Tracker nicht konfiguriert.');
    const request = normalizeVoiceRequest(rawRequest);
    const fingerprint = crypto.createHash('sha256')
      .update(`${provider}\0${request.text}\0${request.gender}\0${request.voiceName}`)
      .digest('hex');
    const existing = records.get(request.effectId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw voiceError('effect_id_conflict', 409, 'Diese Voice-Effekt-ID gehoert bereits zu einem anderen Inhalt.');
      }
      return publicRecord(existing);
    }
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
      provider,
      speaker: request.speaker,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
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

  function getAudio(effectId) {
    const record = records.get(normalizeEffectId(effectId));
    if (!record || record.status !== 'ready' || !Buffer.isBuffer(record.audio)) return null;
    return { body: record.audio, contentType: record.contentType, effectId: record.effectId };
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
    return { released: true, completed, job: publicRecord(record) };
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
    claimPlayback,
    get,
    getAudio,
    getNextPlayback,
    publicState,
    releasePlayback,
    request,
    wait
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
