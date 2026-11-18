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
  let repaired = core.repairDraft(raw, c);
  if (!repaired.draft && raw) {
    // Same as the App: the model is told what was rejected and why.
    raw = await requestJson({ provider, apiKey, fetchRemote, prompt: core.correctionPrompt(prompt, raw, repaired.issues) });
    repaired = core.repairDraft(raw, c);
  }
  const draft = repaired.draft;
  return draft ? { ok: true, draft, issues: repaired.issues } : { ok: false, error: raw ? 'recap_invalid' : 'recap_no_answer', issues: repaired.issues };
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
      await authorityManager.prepareFollowupRecap?.(pilotId);
      item = await authorityManager.nextFollowupRecap?.(pilotId);
      if (!item) return { status: 'idle' };
      const result = await writeRecap({ request: item.request, provider, apiKey, fetchRemote });
      if (result.ok) {
        const saved = await authorityManager.completeFollowupRecap(item.id, pilotId, result.draft);
        log(`MISSION_FOLLOWUP_RECAP_WRITTEN id=${item.id} card=${result.draft.offerText ? 1 : 0} stage=${item.provisional ? 'deboarding' : 'after-close'} repaired=${result.issues?.length || 0} saved=${saved ? 1 : 0}`);
        return { status: saved ? 'written' : 'persist_failed' };
      }
      await authorityManager.failFollowupRecap(item.id, pilotId, result.error);
      log(`MISSION_FOLLOWUP_RECAP_FAILED id=${item.id} attempt=${Number(item.attempts || 0) + 1} error=${result.error} issues=${JSON.stringify(result.issues || [])}`);
      return { status: 'failed', error: result.error };
    } catch (error) {
      if (item) await Promise.resolve(authorityManager.failFollowupRecap(item.id, pilotId, error?.message || 'recap_error')).catch(() => {});
      log(`MISSION_FOLLOWUP_RECAP_FAILED id=${item?.id || 'none'} error=${error?.message || error}`);
      return { status: 'failed', error: error?.message || 'recap_error' };
    } finally { busy = false; }
  }
  // Touchdown near the target: same trigger as the farewell prewarm. The farewell text is optional
  // continuity; the retrospective never waits longer than farewellWaitMs for it.
  async function onTouchdown({ getFarewellText = () => '', farewellWaitMs = 20000, pollMs = 1000 } = {}) {
    if (!configured) return false;
    let farewellText = '';
    for (let waited = 0; waited <= farewellWaitMs; waited += pollMs) {
      try { farewellText = String(getFarewellText() || '').trim(); } catch (_) { farewellText = ''; }
      if (farewellText || waited >= farewellWaitMs) break;
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
    const queued = await authorityManager.prepareFollowupRecap?.(pilotId, { touchdown: true, farewellText });
    log(`MISSION_FOLLOWUP_RECAP_TOUCHDOWN queued=${queued ? 1 : 0} farewell=${farewellText ? 1 : 0}`);
    if (queued) void tick();
    return !!queued;
  }
  return { tick, onTouchdown, configured };
}

module.exports = { createCharterRecapWorker, writeRecap, parseJson };
