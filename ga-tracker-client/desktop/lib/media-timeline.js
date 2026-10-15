'use strict';
// One local clock, before Desktop/Web/EFB fan-out. No extra polling or relay data.
function createMediaTimeline(now = () => performance.now()) {
  let previous = null;
  return function update(value, action = 'snapshot') {
    const { timeline, album, trackNumber, ...result } = value;
    if (!value.ok) { previous = null; return result; }
    if (action === 'duck') return result;
    const at = now();
    if (!value.source || !(value.players || []).some(p => p.source === value.source)) {
      previous = null;
      return {...result, positionSeconds:null, durationSeconds:null, positionKind:'unavailable'};
    }
    const identity = [value.title || '', value.artist || '', album || '', trackNumber || ''];
    const signature = timeline ? JSON.stringify(timeline) : '';
    const sameSource = previous && previous.source === value.source;
    // Metadata enrichment alone is not a new track; conflicting known values are.
    const changed = sameSource && identity.some((part,i) => part && previous.identity[i] && part !== previous.identity[i]);
    const explicitRestart = sameSource && ['next','previous'].includes(action);
    const reset = !sameSource || changed || explicitRestart;
    let blocked = reset && sameSource && signature === previous.signature ? signature : null;
    if (!reset && previous.blocked === signature) blocked = signature;
    const native = blocked === null && Number.isFinite(value.positionSeconds) && value.positionSeconds >= 0;
    let position = native ? value.positionSeconds : reset ? 0 : previous.position + (previous.playing ? Math.max(0,at-previous.at)/1000 : 0);
    const duration = blocked === null && Number.isFinite(value.durationSeconds) && value.durationSeconds > 0 ? value.durationSeconds : null;
    // A metadata-free session is not a track. Never invent a song duration.
    const observed = identity.some(Boolean);
    if (!native && !observed) position = null;
    if (position !== null && duration !== null) position = Math.min(duration, position);
    previous = {source:value.source,identity,signature,blocked,position:position || 0,playing:value.playing,at};
    return {...result,positionSeconds:position,durationSeconds:duration,positionKind:native?'native':observed?'estimated':'unavailable'};
  };
}
module.exports = {createMediaTimeline};
