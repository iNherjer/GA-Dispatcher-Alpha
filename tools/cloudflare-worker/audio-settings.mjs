export async function handleAudioSettings(request, requestUrl, env, helpers) {
  const { json, authenticate, normalizePilotId } = helpers;
  if (!env.GA_SYNC_KV) return json({ error: 'sync_unavailable' }, 503);
  const auth = await authenticate(request, env);
  if (!auth.ok) return auth.response;
  let pilotId;
  try { pilotId = decodeURIComponent(requestUrl.pathname.split('/').at(-1)); }
  catch (_) { return json({ error: 'invalid_pilot_id' }, 400); }
  if (normalizePilotId(pilotId) !== normalizePilotId(auth.ownerId)) return json({ error: 'pilot_mismatch' }, 403);
  const key = `AUDIO_SETTINGS_${auth.ownerId}`;
  if (request.method === 'GET') {
    const stored = await env.GA_SYNC_KV.get(key);
    return json({ record: stored ? JSON.parse(stored) : null }, 200, { 'Cache-Control': 'no-store' });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const text = await request.text();
  if (text.length > 4096) return json({ error: 'audio_settings_too_large' }, 413);
  let source;
  try { source = JSON.parse(text); } catch (_) { return json({ error: 'invalid_json' }, 400); }
  if (source?.schema !== 'ga.audio-control.v1' || !Number.isSafeInteger(source.revision) || source.revision < 0 || !Number.isFinite(source.updatedAt) || source.updatedAt < 0) return json({ error: 'invalid_audio_settings' }, 400);
  const settings = {};
  for (const key of ['enabled', 'paxEnabled', 'effectsEnabled', 'readFreq', 'terrain', 'airspace', 'waypoint']) {
    if (typeof source.settings?.[key] === 'boolean') settings[key] = source.settings[key];
  }
  settings.volume = Math.max(0, Math.min(1, Number(source.settings?.volume) || 0));
  settings.voicePack = /^[a-z0-9-]{0,48}$/.test(source.settings?.voicePack || '') ? source.settings?.voicePack || '' : '';
  settings.audioStyle = ['clear', 'intercom', 'intercom_noise'].includes(source.settings?.audioStyle) ? source.settings.audioStyle : '';
  const target = source.target?.mode === 'app'
    ? { mode: 'app', deviceId: String(source.target.deviceId || '').trim().slice(0, 160), name: String(source.target.name || 'App').slice(0, 80) }
    : { mode: 'pc', deviceId: 'pc', name: 'PC' };
  if (!target.deviceId) return json({ error: 'audio_device_required' }, 400);
  const record = { schema: 'ga.audio-control.v1', revision: source.revision, updatedAt: source.updatedAt, target, settings };
  await env.GA_SYNC_KV.put(key, JSON.stringify(record));
  return json({ ok: true, record });
}
