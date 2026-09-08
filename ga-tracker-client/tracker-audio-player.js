(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GATrackerAudioPlayer = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function createPlayer(options) {
    var context = null, active = null, state = null, fetching = false, stopped = false;
    var deviceId = options.deviceId, clientId = options.clientId, lastNotice = '';
    var request = function (payload) { return options.request(Object.assign({}, payload, { deviceId: deviceId, clientId: clientId })); };
    function selected(kind) {
      if (!state || !state.target || state.target.deviceId !== deviceId || !state.settings.enabled) return false;
      return kind === 'cargo' ? state.settings.effectsEnabled : (kind === 'boarding' || kind === 'farewell') ? (state.settings.paxEnabled || state.settings.effectsEnabled) : state.settings.paxEnabled;
    }
    function getContext() { if (!context) context = new options.AudioContext(); return context; }
    async function unlock() { try { var ctx = getContext(); if (ctx.state !== 'running') await bounded(ctx.resume(), 'audio_unlock_timeout'); return ctx.state === 'running'; } catch (_) { return false; } }
    function bounded(operation, error, abort) {
      var timer;
      return Promise.race([operation, new Promise(function (_, reject) {
        timer = setTimeout(function () { if (abort) abort(); reject(new Error(error)); }, options.preparationTimeoutMs || 15000);
      })]).finally(function () { clearTimeout(timer); });
    }
    function position(current) {
      return { stage: current.stage, offset: Math.max(0, current.offset + (current.source ? getContext().currentTime - current.startedAt : 0)) };
    }
    function silence(current) {
      if (current.download) current.download.abort();
      if (current.source) { try { current.source.stop(); } catch (_) {} }
      if (current.resolveClip) current.resolveClip();
      current.source = null;
      clearTimeout(current.leaseTimer); clearTimeout(current.renewTimer); clearTimeout(current.watchdog);
    }
    async function finish(current, completed, deviceSwitch) {
      if (current.done) return;
      current.done = true;
      var cursor = position(current);
      silence(current);
      try { await request({ action: 'release', effectId: current.job.effectId, completed: completed,
        retryable: !completed && !!deviceSwitch, deviceSwitch: !!deviceSwitch, position: cursor, error: current.error || '' }); } catch (_) {}
      if (active === current) active = null;
      if (typeof options.onPlayback === 'function') options.onPlayback(null);
      if (!deviceSwitch && !stopped) pump();
    }
    function armLease(current, sentAt) {
      clearTimeout(current.leaseTimer);
      // Stop locally before the server's five-second lease can be reassigned.
      var remaining = Math.max(0, 4000 - (Date.now() - (sentAt || Date.now())));
      current.leaseDeadline = Date.now() + remaining;
      if (current.source) { try { current.source.stop(getContext().currentTime + remaining / 1000); } catch (_) {} }
      current.leaseTimer = setTimeout(function () { finish(current, false, true); }, remaining);
    }
    async function renew(current) {
      if (current.done) return;
      try {
        var sentAt = Date.now();
        var result = await request({ action: 'renew', effectId: current.job.effectId, position: position(current) });
        if (current.done) return;
        if (!result.continued) { await finish(current, false, true); return; }
        armLease(current, sentAt);
      } catch (_) { /* The local lease timer stops playback if the tracker cannot be reached. */ }
      if (!current.done) current.renewTimer = setTimeout(function () { renew(current); }, 1000);
    }
    async function playClip(current, stage, gain) {
      if (current.done || (stage === 'cue' && !state.settings.effectsEnabled) || (stage === 'audio' && !state.settings.paxEnabled)) return;
      if (current.stage === 'audio' && stage === 'cue') return;
      if (current.stage !== stage) { current.stage = stage; current.offset = 0; }
      var download = typeof AbortController === 'function' ? new AbortController() : null;
      current.download = download;
      var bytes = await bounded(options.fetchClip(current.job, stage, download && download.signal), stage + '_download_timeout', function () { if (download) download.abort(); });
      if (current.done) return;
      var ctx = getContext();
      var buffer = await bounded(new Promise(function (resolve, reject) {
        var result = ctx.decodeAudioData(bytes, resolve, reject);
        if (result && result.then) result.then(resolve, reject);
      }), stage + '_decode_timeout');
      if (current.done || current.offset >= buffer.duration) return;
      if (ctx.state !== 'running') await bounded(ctx.resume(), 'audio_unlock_timeout');
      if (current.done) return;
      if (ctx.state !== 'running') throw new Error('audio_locked');
      var sinkId = options.getOutputDeviceId ? options.getOutputDeviceId() : '';
      if (typeof ctx.setSinkId === 'function' && ctx.sinkId !== sinkId) await ctx.setSinkId(sinkId || '');
      if (current.done) return;
      var source = ctx.createBufferSource(), volume = ctx.createGain();
      current.source = source; current.gain = volume; current.clipGain = gain;
      source.buffer = buffer; source.connect(volume); volume.connect(ctx.destination);
      volume.gain.value = state.settings.volume * gain;
      current.startedAt = ctx.currentTime;
      await new Promise(function (resolve, reject) {
        var done = false;
        var playbackTimer = setTimeout(function () { end(new Error('audio_playback_stalled')); }, Math.max(1000, (buffer.duration - current.offset + 2.5) * 1000));
        function end(error) {
          if (done) return; done = true;
          clearTimeout(playbackTimer);
          source.onended = null;
          try { source.disconnect(); volume.disconnect(); } catch (_) {}
          if (error) reject(error); else resolve();
        }
        current.resolveClip = function () { end(); };
        source.onended = function () { end(); };
        source.start(0, current.offset);
        source.stop(ctx.currentTime + Math.max(0, current.leaseDeadline - Date.now()) / 1000);
      });
      if (current.skipCue && stage === 'cue') { current.source = null; current.offset = 0; return; }
      if (!current.done && position(current).offset + 0.1 < buffer.duration) throw new Error('audio_lease_expired');
      if (!current.done) { current.source = null; current.offset = 0; }
    }
    async function pump() {
      if (stopped || fetching || active || !state || !state.target || state.target.deviceId !== deviceId || !state.settings.enabled) return;
      fetching = true;
      var ownsFetch = true;
      try {
        var next = await request({ action: 'next' });
        if (!next.job || stopped || !selected(next.job.kind)) return;
        if (!await unlock()) { if (options.onError) options.onError('Audio bitte durch Antippen aktivieren.'); return; }
        var started = Date.now();
        var claim = await request({ action: 'claim', effectId: next.job.effectId });
        if (!claim.claimed) return;
        var cursor = claim.job && claim.job.playback && claim.job.playback.position || { stage: 'cue', offset: 0 };
        var current = { job: next.job, stage: cursor.stage, offset: cursor.offset, startedAt: 0, done: false };
        active = current;
        if (stopped || !selected(next.job.kind) || Date.now() - started > 3000) { await finish(current, false, true); return; }
        armLease(current, started); current.renewTimer = setTimeout(function () { renew(current); }, 1000);
        current.watchdog = setTimeout(function () { finish(current, false, false); }, 180000);
        if (options.onPlayback) options.onPlayback(next.job);
        // Do not hold the pump lock during the clip: completion can request the next job.
        fetching = false; ownsFetch = false;
        try {
          if (next.job.cue && next.job.cue.audioAvailable) {
            try { await playClip(current, 'cue', Number(next.job.cue.gain) || 0.38); }
            catch (error) {
              if (!next.job.audioAvailable) throw error;
              if (current.source) { try { current.source.stop(); } catch (_) {} current.source = null; }
              current.offset = 0;
              if (options.onError) options.onError(error.message);
            }
          }
          if (!current.done && next.job.audioAvailable) await playClip(current, 'audio', 1);
          if (!current.done) await finish(current, true, false);
        } catch (error) {
          current.error = error.message || 'audio_playback_failed';
          if (!current.done && options.onError) options.onError(current.error);
          await finish(current, false, false);
        }
      } catch (error) { if (options.onError) options.onError(error.message || 'Tracker nicht erreichbar.'); }
      finally { if (ownsFetch) fetching = false; }
    }
    function update(value) {
      state = value;
      if (active && !selected(active.job.kind)) finish(active, false, true);
      else if (active && state && active.stage === 'audio' && !state.settings.paxEnabled) finish(active, true, false);
      else if (active && state && active.stage === 'cue' && !state.settings.effectsEnabled && active.source) {
        active.skipCue = true; try { active.source.stop(); } catch (_) {}
        if (active.resolveClip) active.resolveClip();
      }
      if (active && active.gain && state) active.gain.gain.value = state.settings.volume * active.clipGain;
      var notice = state ? state.revision + ':' + (state.playback && state.playback.notification || '') : '';
      if (notice !== lastNotice) {
        lastNotice = notice;
        if (state && state.playback && state.playback.playbackAvailable) pump();
      }
    }
    async function stop() { stopped = true; if (active) await finish(active, false, true); if (context) await context.close(); }
    return { update: update, pump: pump, unlock: unlock, stop: stop,
      setOutputDevice: async function (id) { var ctx = getContext(); if (typeof ctx.setSinkId !== 'function') throw new Error('Ausgangswahl wird auf diesem Gerät nicht unterstützt.'); await ctx.setSinkId(id || ''); },
      get active() { return !!active; } };
  }
  return { createPlayer: createPlayer };
});
