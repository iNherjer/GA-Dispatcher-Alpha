'use strict';
const cueCore = require('../mission-boarding-voice-core.js');

function cueEntry(payload) {
  const item = payload.item || {};
  const action = payload.action;
  const passenger = item.itemType === 'passenger';
  const event = passenger ? (action === 'unload' ? 'passenger_unload' : (action === 'reload' ? 'passenger_reload' : 'passenger_load'))
    : (action === 'unload' || action === 'drop' ? action : (item.pickupLocation === 'target' ? 'pickup' : action));
  const fallback = passenger ? (action === 'unload' ? 'deboarding_pax' : 'boarding_pax')
    : (action === 'unload' ? 'cargo_unload' : action === 'drop' ? 'cargo_drop' : item.pickupLocation === 'target' ? 'cargo_pickup' : 'cargo_load');
  return { item, event, fallback, gain: passenger ? 0.38 : null, queued: !passenger && action !== 'drop' };
}
function cueRecipe(context, entry) {
  const event = entry.event;
  let value = entry.fallback, found = false;
  for (const source of context.sources || []) {
    for (const key of [`cargo.${event}`, `cargo:${event}`, `cargo_${event}`, event, 'cargo']) {
      if (Object.prototype.hasOwnProperty.call(source, key)) { value = source[key]; found = true; break; }
    }
    if (found) break;
    if (source.cargo && typeof source.cargo === 'object') {
      if (Object.prototype.hasOwnProperty.call(source.cargo, event)) { value = source.cargo[event]; found = true; }
      else if (Object.prototype.hasOwnProperty.call(source.cargo, 'default')) { value = source.cargo.default; found = true; }
    }
    if (found) break;
  }
  const id = cueCore.normalizeCueId(value);
  const def = context.catalog?.[id];
  if (!def || def.disabled) return null;
  const item = entry.item || {};
  const seed = [context.missionKey, event, item.id || item.label || '', item.pickupLocation || '', item.itemType || ''].join('|');
  return { id, gain: entry.gain == null ? def.gain : entry.gain,
    variantSeed: `cue-variant-${id}${context.missionAudioKey}|${seed}|${id}` };
}
function createTrackerMissionCargoAudio({ authorityManager, voiceService, getAudioPlaybackCandidates = () => 0, getAudioSettings = () => null, playbackClaimTimeoutMs = 15000, log = () => {} }) {
  let active = false;
  const pending = [];
  async function play(batch) {
    const first = batch[0];
    const run = authorityManager.getActiveRun({ includeBundle: true });
    if (!run || run.runId !== first.request.runId || run.missionId !== first.request.missionId) return;
    const context = run.resumeBundle?.executionEffectPlan?.cargoAudio;
    const settings = getAudioSettings();
    if (!context || !voiceService || (settings ? !(settings.enabled && settings.effectsEnabled) : (!context.enabled || !getAudioPlaybackCandidates()))) return;
    const entry = batch.length === 1 ? first.entry : { fallback: 'boarding_cargo', gain: 0.46, item: null,
      event: `${first.entry.event || 'cargo'}_batch_${batch.length}_${batch.map(value => value.entry.item?.id || value.entry.item?.label || value.entry.event || '').filter(Boolean).join('-') || 'items'}` };
    const cue = cueRecipe(context, entry);
    if (!cue) return;
    const effectId = first.request.commandId;
    voiceService.request({ effectId, kind: 'cargo', cue, synthesizeAudio: false });
    const job = await voiceService.wait(effectId);
    if (!job?.cue?.audioAvailable) { voiceService.cancel?.(effectId, 'cargo_cue_missing'); return; }
    // Like boarding/farewell, an audio-capable device is not proof of playback.
    // An unclaimed effect must not hold subsequent cargo cues for two minutes.
    if (typeof voiceService.waitForPlaybackClaim === 'function') {
      const claim = await voiceService.waitForPlaybackClaim(effectId, { timeoutMs: playbackClaimTimeoutMs });
      if (claim?.claimed !== true) {
        voiceService.cancel?.(effectId, 'cargo_cue_no_audio_claim');
        log(`MISSION_CARGO_AUDIO_SKIPPED effect=${effectId} reason=no_audio_claim`);
        return;
      }
      if (claim.status === 'completed') return;
    }
    const playback = await voiceService.waitForPlayback(effectId, { timeoutMs: 120000 });
    if (playback?.status === 'timeout') voiceService.cancel?.(effectId, 'cargo_cue_timeout');
  }
  async function flush(batch) {
    try { await play(batch); } catch (_) { /* Sound failure must not block manifest handling. */ }
    for (const entry of batch) entry.resolve({ ok: true, status: 'completed', sideEffect: true });
    if (pending.length) {
      const nextRun = pending[0].request.runId;
      const next = [];
      while (pending.length && pending[0].request.runId === nextRun) next.push(pending.shift());
      void flush(next);
    } else active = false;
  }
  return request => new Promise(resolve => {
    const entry = { request, entry: cueEntry(request.effect.payload), resolve };
    if (!entry.entry.queued) { play([entry]).catch(() => {}).then(() => resolve({ ok: true, status: 'completed' })); return; }
    if (active) { pending.push(entry); return; }
    active = true;
    void flush([entry]);
  });
}
module.exports = { cueEntry, cueRecipe, createTrackerMissionCargoAudio };
