'use strict';
// Writes the stay retrospective of a charter/reporter return offer right after the outbound landing,
// with the shared prompt and validation of the App. Without it, the App writes the same draft on accept.
const core = require('../mission-charter-continuation-core.js');
const { GEMINI_TEXT_MODELS, OPENAI_TEXT_MODELS } = require('../mission-boarding-voice-core.js');

const REQUEST_TIMEOUT_MS = 60000;

function parseJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(raw); } catch (_) {}
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

async function withTimeout(fetchRemote, url, init) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try { return await fetchRemote(url, { ...init, ...(controller ? { signal: controller.signal } : {}) }); }
  finally { if (timer) clearTimeout(timer); }
}

async function requestJson({ provider, apiKey, fetchRemote, prompt }) {
  if (provider === 'openai') {
    for (const model of OPENAI_TEXT_MODELS) {
      try {
        const response = await withTimeout(fetchRemote, 'https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] })
        });
        if (!response?.ok) continue;
        const parsed = parseJson((await response.json())?.choices?.[0]?.message?.content);
        if (parsed) return parsed;
      } catch (_) {}
    }
    return null;
  }
  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const response = await withTimeout(fetchRemote, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
      });
      if (!response?.ok) continue;
      const parsed = parseJson((await response.json())?.candidates?.[0]?.content?.parts?.[0]?.text);
      if (parsed) return parsed;
    } catch (_) {}
  }
  return null;
}

async function writeRecap({ request, provider, apiKey, fetchRemote }) {
  const c = core.context(request);
  if (!c) return { ok: false, error: 'recap_no_context' };
  const prompt = core.draftPrompt(c);
  let raw = await requestJson({ provider, apiKey, fetchRemote, prompt });
  let draft = core.validateDraft(raw, c);
  if (!draft && raw) {
    // Same structural correction the App uses: keep content and identities, fix the form.
    raw = await requestJson({ provider, apiKey, fetchRemote, prompt: `${prompt}\nKorrigiere nur die Struktur des bisherigen Entwurfs. Bewahre dessen Inhalt und Identitäten. Vollständiges JSON als einzelnes Objekt, gültige Feldlängen und belegte Geo-Anker. ENTWURF: ${JSON.stringify(raw)}` });
    draft = core.validateDraft(raw, c);
  }
  return draft ? { ok: true, draft } : { ok: false, error: raw ? 'recap_invalid' : 'recap_no_answer' };
}

function createCharterRecapWorker({ authorityManager, pilotId, provider, apiKey, fetchRemote = globalThis.fetch, log = () => {} }) {
  const configured = !!(authorityManager && pilotId && apiKey && ['gemini', 'openai'].includes(provider) && typeof fetchRemote === 'function');
  let busy = false;
  async function tick() {
    if (!configured || busy) return { status: configured ? 'busy' : 'unconfigured' };
    busy = true;
    let item = null;
    try {
      // The authority core may live in the mission worker process: every call is awaited.
      item = await authorityManager.nextFollowupRecap?.(pilotId);
      if (!item) return { status: 'idle' };
      const result = await writeRecap({ request: item.request, provider, apiKey, fetchRemote });
      if (result.ok) {
        const saved = await authorityManager.completeFollowupRecap(item.id, pilotId, result.draft);
        log(`MISSION_FOLLOWUP_RECAP_WRITTEN id=${item.id} card=${result.draft.offerText ? 1 : 0} saved=${saved ? 1 : 0}`);
        return { status: saved ? 'written' : 'persist_failed' };
      }
      await authorityManager.failFollowupRecap(item.id, pilotId, result.error);
      log(`MISSION_FOLLOWUP_RECAP_FAILED id=${item.id} attempt=${Number(item.attempts || 0) + 1} error=${result.error}`);
      return { status: 'failed', error: result.error };
    } catch (error) {
      if (item) await Promise.resolve(authorityManager.failFollowupRecap(item.id, pilotId, error?.message || 'recap_error')).catch(() => {});
      log(`MISSION_FOLLOWUP_RECAP_FAILED id=${item?.id || 'none'} error=${error?.message || error}`);
      return { status: 'failed', error: error?.message || 'recap_error' };
    } finally { busy = false; }
  }
  return { tick, configured };
}

module.exports = { createCharterRecapWorker, writeRecap, parseJson };
