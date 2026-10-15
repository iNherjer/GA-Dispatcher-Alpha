'use strict';
const ACTIONS = new Set(['snapshot','watch','select','play','pause','playPause','next','previous','volume','settings','duck']);
function normalizeMediaCommand(value = {}) {
  if (!value || !ACTIONS.has(value.action)) throw new Error('media_command_invalid');
  const result = { action: value.action };
  if (value.action === 'select') {
    if (typeof value.source !== 'string' || !value.source || value.source.length > 256) throw new Error('media_source_invalid');
    result.source = value.source;
  }
  if (value.action === 'watch') result.after = Number.isSafeInteger(value.after) && value.after >= 0 ? value.after : -1;
  if (value.action === 'volume' || value.action === 'settings') {
    const key = value.action === 'volume' ? 'volume' : 'factor';
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1) throw new Error('media_volume_invalid');
    result[key] = value[key];
    if (key === 'factor') result.enabled = value.enabled === true;
  }
  if (value.action === 'duck') result.active = value.active === true;
  return result;
}
function createMediaRelay(execute, now = Date.now) {
  const pending = new Map(); let recent = [];
  return command => {
    if (!command || !/^[A-Za-z0-9._:-]{1,220}$/.test(command.clientId || '') || !/^[A-Za-z0-9._:-]{1,220}$/.test(command.commandId || '')) return Promise.resolve({ok:false,error:'media_command_invalid'});
    let payload;
    try { payload = normalizeMediaCommand(command.payload); } catch (error) { return Promise.resolve({ok:false,error:error.message}); }
    const key = command.clientId + ':' + command.commandId, fingerprint = JSON.stringify(payload);
    for (const [id, entry] of pending) if (now() - entry.at > 600000) pending.delete(id);
    const previous = pending.get(key);
    if (previous) return previous.fingerprint === fingerprint ? previous.promise : Promise.resolve({ok:false,error:'command_id_conflict'});
    recent = recent.filter(at => now() - at < 60000);
    if (recent.length >= 600 || pending.size >= 512) return Promise.resolve({ok:false,error:'media_rate_limited'});
    recent.push(now());
    const promise = Promise.resolve().then(() => execute({...payload,clientId:command.clientId})).catch(error => ({ok:false,error:error.message}));
    // Keep non-idempotent transport operations deduplicated across both relays.
    const entry = {promise,fingerprint,at:now()}; pending.set(key,entry);
    if (['watch','snapshot','duck'].includes(payload.action)) promise.finally(() => { entry.at = now() - 595000; });
    return promise;
  };
}
function mediaStateChanged(previous, next, anchorAt, now = Date.now()) {
  if (!previous || !next || previous.ok !== next.ok) return true;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;
  const omit = value => { const { id, positionSeconds, sampledAt, ...rest } = value; return canonical(rest); };
  if (JSON.stringify(omit(previous)) !== JSON.stringify(omit(next))) return true;
  if (next.playing && Number.isFinite(next.positionSeconds) && now - anchorAt >= 15000) return true;
  if (Number.isFinite(previous.positionSeconds) && Number.isFinite(next.positionSeconds)) {
    const predicted = previous.positionSeconds + (previous.playing ? Math.max(0, now - previous.sampledAt) / 1000 : 0);
    if (Math.abs(predicted - next.positionSeconds) > 2) return true;
  }
  return false;
}
module.exports = {normalizeMediaCommand,createMediaRelay,mediaStateChanged};
