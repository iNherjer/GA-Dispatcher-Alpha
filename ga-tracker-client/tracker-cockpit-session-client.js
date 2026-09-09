(function initTrackerCockpitSessionClient(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GATrackerCockpitSessionClient = api;
})(typeof window !== 'undefined' ? window : null, function createTrackerCockpitSessionClientModule() {
  'use strict';

  const runtime = typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : {});
  const DEFAULT_BASE_URL = 'http://127.0.0.1:49880/api/v1';
  const CLIENT_ID_STORAGE_KEY = 'ga_cockpit_client_id_v1';

  // Bound headers AND body consumption, including older Coherent engines that
  // cannot abort fetch. A late response must never reach the caller's renderer.
  function requestJson(fetchRemote, url, init, timeoutMs) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const options = Object.assign({}, init || {});
    if (controller) options.signal = controller.signal;
    let timer;
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('tracker_request_timeout'));
        if (controller) controller.abort();
      }, Math.max(1, Number(timeoutMs) || 5000));
    });
    const operation = Promise.resolve().then(() => fetchRemote(url, options))
      .then(async response => ({ response, body: await response.json() }));
    return Promise.race([operation, deadline]).then(value => {
      clearTimeout(timer); return value;
    }, error => { clearTimeout(timer); throw error; });
  }

  function cleanBaseUrl(value) {
    return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  }

  function randomId(prefix = 'client') {
    const cryptoApi = runtime.crypto || null;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return `${prefix}-${cryptoApi.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function storedClientId(role) {
    try {
      const key = `${CLIENT_ID_STORAGE_KEY}:${role}`;
      const existing = String(runtime.sessionStorage && runtime.sessionStorage.getItem(key) || '').trim();
      if (existing) return existing.slice(0, 220);
      const created = randomId(role);
      if (runtime.sessionStorage) runtime.sessionStorage.setItem(key, created);
      return created;
    } catch (_) {
      return randomId(role);
    }
  }

  function responsePayload(value) {
    return value && value.message && value.message.payload && typeof value.message.payload === 'object'
      ? value.message.payload
      : null;
  }

  function createClient(options = {}) {
    const baseUrl = cleanBaseUrl(options.baseUrl);
    const role = ['web', 'efb', 'toolbar'].includes(String(options.role || '').toLowerCase())
      ? String(options.role).toLowerCase()
      : 'web';
    const clientId = String(options.clientId || (role === 'web' && typeof runtime.gaTrackerAudioRelayClientId === 'function' ? runtime.gaTrackerAudioRelayClientId() : storedClientId(role))).trim().slice(0, 220);
    const fetchHttp = typeof options.fetchRemote === 'function' ? options.fetchRemote : runtime.fetch;
    const relayAvailable = () => role === 'web' && typeof runtime.gaTrackerVoiceRelayAvailable === 'function'
      && runtime.gaTrackerVoiceRelayAvailable() === true;
    async function fetchRemote(url, init = {}) {
      if (!relayAvailable() || !url.includes('/voice/')) return fetchHttp(url, init);
      const body = init.body ? JSON.parse(init.body) : {};
      const route = url.slice(url.indexOf('/voice/') + 7).split('?')[0];
      const match = /^jobs\/([^/]+)\/(audio|cue)$/.exec(route);
      const request = match
        ? { action: match[2], effectId: decodeURIComponent(match[1]), offset: 0 }
        : Object.assign({}, body, { action: route.replace('playback/', '') });
      const call = payload => runtime.gaTrackerVoiceRelayRequest(Object.assign({}, payload, { clientId }));
      let payload = await call(request);
      if (!match) return { ok: true, status: 200, json: async () => ({ message: { payload } }) };
      const bytes = new Uint8Array(payload.total);
      let offset = 0;
      while (true) {
        if (payload.offset !== offset || payload.total !== bytes.length) throw new Error('voice_chunk_mismatch');
        const decoded = runtime.atob(payload.data);
        if (!decoded.length || offset + decoded.length > bytes.length) throw new Error('voice_chunk_invalid');
        for (let i = 0; i < decoded.length; i++) bytes[offset + i] = decoded.charCodeAt(i);
        offset += decoded.length;
        if (offset === bytes.length) break;
        payload = await call(Object.assign({}, request, { offset }));
      }
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer };
    }
    const getAudioPlaybackEnabled = typeof options.getAudioPlaybackEnabled === 'function'
      ? options.getAudioPlaybackEnabled
      : () => options.audioPlaybackEnabled === true;
    const listenForVoice = typeof options.listenForVoice === 'function'
      ? options.listenForVoice
      : () => options.listenForVoice === true;
    const voicePlaybackWatchdogMs = Math.max(1000, Math.min(180000,
      Number(options.voicePlaybackWatchdogMs) || 75000));
    let session = null;
    let sessionToken = '';
    let heartbeatTimer = null;
    let voiceTimer = null;
    let activeVoice = null;
    let audioUnlockPromise = null;
    let audioUnlocked = false;
    let playbackContext = null;
    function getPlaybackContext() {
      const Ctor = options.AudioContext || runtime.AudioContext || runtime.webkitAudioContext;
      if (!playbackContext && typeof Ctor === 'function') {
        try { playbackContext = new Ctor(); } catch (_) { return null; }
      }
      return playbackContext;
    }
    const voiceCooldowns = new Map();
    let stopped = false;
    let playbackUnavailableUntil = 0;

    function unlockAudioPlayback() {
      if (audioUnlocked) return Promise.resolve(true);
      if (audioUnlockPromise) return audioUnlockPromise;
      if (getAudioPlaybackEnabled() !== true) return Promise.resolve(false);
      const context = getPlaybackContext();
      if (context) {
        // Called directly in the user gesture, before any network await.
        return Promise.resolve(context.resume()).then(() => context.state === 'running').catch(() => false);
      }
      const AudioCtor = options.Audio || runtime.Audio;
      if (typeof AudioCtor !== 'function') return Promise.resolve(false);
      audioUnlockPromise = Promise.resolve().then(async () => {
        var probe = new AudioCtor('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA');
        try { probe.volume = 0; } catch (_) {}
        try {
          await Promise.resolve(probe.play());
          try { probe.pause(); } catch (_) {}
          try { probe.currentTime = 0; } catch (_) {}
          audioUnlocked = true;
          return true;
        } catch (_) {
          return false;
        }
      });
      // MSFS Coherent does not expose Promise.prototype.finally reliably.
      // Keep the cleanup on both settlement paths without depending on it.
      audioUnlockPromise.then(function () {
        audioUnlockPromise = null;
      }, function () {
        audioUnlockPromise = null;
      });
      return audioUnlockPromise;
    }

    async function post(pathname, payload, keepalive = false) {
      if (typeof fetchRemote !== 'function') throw new Error('fetch_unavailable');
      const result = await requestJson(fetchRemote, `${baseUrl}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
        cache: 'no-store',
        keepalive
      }, options.requestTimeoutMs || 10000);
      return { response: result.response, payload: responsePayload(result.body) };
    }

    async function get(pathname) {
      if (typeof fetchRemote !== 'function') throw new Error('fetch_unavailable');
      const result = await requestJson(fetchRemote, `${baseUrl}${pathname}`, {
        method: 'GET',
        cache: 'no-store'
      }, options.requestTimeoutMs || 5000);
      return { response: result.response, payload: responsePayload(result.body) };
    }

    function schedule(ms) {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      if (stopped) return;
      heartbeatTimer = setTimeout(() => heartbeat().catch(() => {}), Math.max(5000, Number(ms) || 15000));
    }

    function scheduleVoice(ms = 900) {
      if (voiceTimer) clearTimeout(voiceTimer);
      if (stopped) return;
      voiceTimer = setTimeout(() => pollVoice().catch(() => {}), Math.max(300, Number(ms) || 900));
    }

    async function releaseVoice(effectId, completed) {
      try {
        await post('/voice/playback/release', { effectId, clientId, completed: completed === true, retryable: completed !== true });
      } catch (_) {}
    }

    async function stopVoice(completed = false) {
      const current = activeVoice;
      activeVoice = null;
      if (!current) return;
      current.cancelled = true;
      if (current.cancel) current.cancel();
      for (const audio of [current.cueAudio, current.audio].filter(Boolean)) {
        try { audio.onended = null; audio.onerror = null; } catch (_) {}
        try { audio.pause(); } catch (_) {}
        try { audio.currentTime = 0; } catch (_) {}
      }
      if (current.watchdogTimer) clearTimeout(current.watchdogTimer);
      await releaseVoice(current.effectId, completed);
    }

    async function playDecodedVoice(job) {
      const context = getPlaybackContext();
      const current = { effectId: job.effectId, watchdogTimer: null, source: null, cancelled: false, cancel: null };
      activeVoice = current;
      let done = false;
      const finish = async completed => {
        if (done) return;
        done = true;
        current.cancelled = true;
        if (current.cancel) current.cancel();
        if (current.watchdogTimer) clearTimeout(current.watchdogTimer);
        if (activeVoice === current) activeVoice = null;
        await releaseVoice(job.effectId, completed);
        scheduleVoice(250);
      };
      // A suspended/undecodable player should fail promptly, not consume the
      // entire mission watchdog. Once playing, use the clip's real duration.
      current.watchdogTimer = setTimeout(() => { finish(false).catch(() => {}); }, relayAvailable() ? 60000 : 8000);
      async function clip(suffix, gain) {
        const assetName = String(job.cue && job.cue.assetName || '');
        const staticCue = suffix === 'cue' && relayAvailable() && /^[a-zA-Z0-9_-]+\.mp3$/.test(assetName);
        // Static repository clips bypass Cloudflare; only generated voice uses the relay.
        const response = staticCue
          ? await fetchHttp('https://inherjer.github.io/GA-Dispatcher-Alpha/audio-cues/' + encodeURIComponent(assetName), { cache: 'force-cache' })
          : await fetchRemote(`${baseUrl}/voice/jobs/${encodeURIComponent(job.effectId)}/${suffix}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('voice_audio_fetch_failed');
        const bytes = await response.arrayBuffer();
        const buffer = await new Promise((resolve, reject) => {
          const decoded = context.decodeAudioData(bytes, resolve, reject);
          if (decoded && typeof decoded.then === 'function') decoded.then(resolve, reject);
        });
        if (current.cancelled) return;
        await context.resume();
        if (current.cancelled) return;
        if (context.state !== 'running') throw new Error('voice_audio_locked');
        const source = context.createBufferSource();
        const volume = context.createGain();
        let master = 1;
        try {
          const stored = runtime.localStorage && runtime.localStorage.getItem('awm_volume');
          if (stored != null && Number.isFinite(Number(stored))) master = Math.max(0, Math.min(1, Number(stored)));
        } catch (_) {}
        volume.gain.value = master * gain;
        source.buffer = buffer;
        source.connect(volume);
        volume.connect(context.destination);
        current.source = source;
        clearTimeout(current.watchdogTimer);
        current.watchdogTimer = setTimeout(() => { finish(false).catch(() => {}); }, Math.min(180000, Math.max(8000, buffer.duration * 1000 + 5000)));
        await new Promise(resolve => {
          function cleanup() {
            source.onended = null;
            try { source.disconnect(); volume.disconnect(); } catch (_) {}
            resolve();
          }
          source.onended = cleanup;
          current.cancel = () => { try { source.stop(); } catch (_) {} cleanup(); };
          source.start(0);
        });
      }
      try {
        if (job.cue && job.cue.audioAvailable === true) {
          try { await clip('cue', Math.max(0, Math.min(1, Number(job.cue.gain) || 0.38))); } catch (error) { if (job.kind === 'cargo') throw error; }
        }
        if (!current.cancelled && job.kind !== 'cargo') await clip('audio', 1);
        if (!current.cancelled) await finish(true);
      } catch (_) { await finish(false); }
      return !current.cancelled || done;
    }

    async function playVoiceJob(job) {
      const jobSource = job && typeof job === 'object' ? job : {};
      const effectId = String(jobSource.effectId || '').trim();
      if (!effectId || activeVoice || getAudioPlaybackEnabled() !== true) return false;
      const context = getPlaybackContext();
      if (context) {
        try { await context.resume(); } catch (_) { return false; }
        if (context.state !== 'running') return false;
      }
      const claim = await post('/voice/playback/claim', { effectId, clientId, leaseMs: 120000 });
      if (!claim.response.ok || !claim.payload || claim.payload.claimed !== true) return false;
      try {
        runtime.dispatchEvent(new runtime.CustomEvent('ga:tracker-voice-playback', {
          detail: {
            effectId,
            kind: String(jobSource.kind || ''),
            text: String(jobSource.text || ''),
            speaker: jobSource.speaker && typeof jobSource.speaker === 'object' ? Object.assign({}, jobSource.speaker) : {},
            provider: String(jobSource.provider || ''),
            model: String(jobSource.model || ''),
            voiceName: String(jobSource.voiceName || '')
          }
        }));
      } catch (_) {}
      if (getPlaybackContext()) return playDecodedVoice(jobSource);
      const AudioCtor = options.Audio || runtime.Audio;
      if (typeof AudioCtor !== 'function') {
        await releaseVoice(effectId, false);
        return false;
      }
      const audio = jobSource.kind === 'cargo' ? new AudioCtor()
        : new AudioCtor(`${baseUrl}/voice/jobs/${encodeURIComponent(effectId)}/audio`);
      const cue = jobSource.cue && typeof jobSource.cue === 'object' ? jobSource.cue : null;
      const cueAudio = cue && cue.audioAvailable === true
        ? new AudioCtor(`${baseUrl}/voice/jobs/${encodeURIComponent(effectId)}/cue`)
        : null;
      let masterVolume = 1;
      try {
        audio.volume = 1;
        if (cueAudio) cueAudio.volume = Math.max(0, Math.min(1, Number(cue.gain) || 0.38));
      } catch (_) {}
      try {
        const storedValue = typeof runtime.document !== 'undefined' && runtime.localStorage
          ? runtime.localStorage.getItem('awm_volume') : null;
        const storedVolume = storedValue == null ? NaN : Number(storedValue);
        masterVolume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(1, storedVolume)) : 1;
        audio.volume = masterVolume;
        if (cueAudio) cueAudio.volume = Math.max(0, Math.min(1, masterVolume * (Number(cue.gain) || 0.38)));
      } catch (_) {}
      activeVoice = { effectId, audio, cueAudio, watchdogTimer: null };
      let finished = false;
      let voiceStarted = false;
      let progressTimer = null;
      function watchStart(player, onStall) {
        if (progressTimer) clearTimeout(progressTimer);
        const initialTime = Number(player.currentTime) || 0;
        progressTimer = setTimeout(() => {
          if (!finished && !(Number(player.currentTime) > initialTime)) {
            playbackUnavailableUntil = Date.now() + 60000;
            onStall();
          }
        }, 5000);
      }
      const finish = async (completed) => {
        if (finished) return;
        finished = true;
        if (progressTimer) clearTimeout(progressTimer);
        if (activeVoice && activeVoice.watchdogTimer) clearTimeout(activeVoice.watchdogTimer);
        if (activeVoice && activeVoice.audio === audio) activeVoice = null;
        for (const item of [cueAudio, audio].filter(Boolean)) {
          try { item.onended = null; item.onerror = null; item.pause(); } catch (_) {}
        }
        if (!completed) voiceCooldowns.set(effectId, Date.now() + 10000);
        await releaseVoice(effectId, completed);
        scheduleVoice(completed ? 250 : 1500);
      };
      activeVoice.cancel = () => { finished = true; if (progressTimer) clearTimeout(progressTimer); };
      activeVoice.watchdogTimer = setTimeout(() => {
        finish(false).catch(() => {});
      }, voicePlaybackWatchdogMs);
      audio.onended = () => finish(true).catch(() => {});
      audio.onerror = () => finish(false).catch(() => {});
      const startVoice = async () => {
        if (voiceStarted || finished) return true;
        voiceStarted = true;
        if (jobSource.kind === 'cargo') { await finish(true); return true; }
        try {
          watchStart(audio, () => finish(false).catch(() => {}));
          await audio.play();
          return true;
        } catch (_) {
          await finish(false);
          return false;
        }
      };
      if (cueAudio) {
        cueAudio.onended = () => startVoice().catch(() => {});
        cueAudio.onerror = () => (jobSource.kind === 'cargo' ? finish(false) : startVoice()).catch(() => {});
      }
      try {
        if (cueAudio) {
          watchStart(cueAudio, () => {
            try { cueAudio.pause(); } catch (_) {}
            (jobSource.kind === 'cargo' ? finish(false) : startVoice()).catch(() => {});
          });
          await cueAudio.play();
        }
        else await startVoice();
        return true;
      } catch (_) {
        if (jobSource.kind === 'cargo') { await finish(false); return false; }
        return startVoice();
      }
    }

    async function pollVoice() {
      if (stopped) return;
      if (runtime.gaTrackerAudioClient && runtime.gaTrackerAudioClient.active()) {
        if (activeVoice) await stopVoice(false);
        scheduleVoice(5000); return;
      }
      if (Date.now() < playbackUnavailableUntil || listenForVoice() !== true || (!relayAvailable() && (!session || !session.sessionId)) || getAudioPlaybackEnabled() !== true || activeVoice) {
        scheduleVoice(activeVoice ? 500 : 1200);
        return;
      }
      try {
        const result = await fetchRemote(`${baseUrl}/voice/playback/next?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' });
        let body = null;
        try { body = await result.json(); } catch (_) {}
        const next = responsePayload(body);
        const job = next && next.available ? next.job : null;
        const cooldownUntil = Number(voiceCooldowns.get(String(job && job.effectId || '')) || 0);
        if (job && cooldownUntil <= Date.now()) await playVoiceJob(job);
      } catch (_) {}
      if (!activeVoice) scheduleVoice(900);
    }

    async function register() {
      if (stopped) return null;
      if (relayAvailable()) { session = null; sessionToken = ''; scheduleVoice(250); schedule(15000); return null; }
      try {
        const result = await post('/cockpit/sessions', {
          clientId,
          role,
          appVersion: String(options.appVersion || '').slice(0, 80),
          capabilities: Array.isArray(options.capabilities) ? options.capabilities : [],
          audioPlaybackEnabled: getAudioPlaybackEnabled() === true
        });
        if (!result.response.ok || !result.payload || !result.payload.session || !result.payload.sessionToken) {
          session = null;
          sessionToken = '';
          schedule(30000);
          return null;
        }
        session = result.payload.session;
        sessionToken = result.payload.sessionToken;
        schedule(result.payload.heartbeatAfterMs);
        scheduleVoice(250);
        return session;
      } catch (_) {
        session = null;
        sessionToken = '';
        schedule(30000);
        return null;
      }
    }

    async function heartbeat() {
      if (stopped) return null;
      if (relayAvailable() || !session || !session.sessionId || !sessionToken) return register();
      try {
        const result = await post('/cockpit/sessions/heartbeat', {
          sessionId: session.sessionId,
          sessionToken,
          audioPlaybackEnabled: getAudioPlaybackEnabled() === true
        });
        if (!result.response.ok || !result.payload || !result.payload.session) return register();
        session = result.payload.session;
        schedule(Math.max(5000, Math.floor((session.expiresAt - Date.now()) / 3)));
        return session;
      } catch (_) {
        schedule(15000);
        return null;
      }
    }

    async function stop() {
      stopped = true;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
      if (voiceTimer) clearTimeout(voiceTimer);
      voiceTimer = null;
      await stopVoice(false);
      const current = session;
      const token = sessionToken;
      session = null;
      sessionToken = '';
      if (!current || !current.sessionId || !token) return;
      try {
        await post('/cockpit/sessions/release', {
          sessionId: current.sessionId,
          sessionToken: token
        }, true);
      } catch (_) {}
    }

    function authEnvelope() {
      if (!session || !session.sessionId || !sessionToken) return null;
      return { sessionId: session.sessionId, sessionToken };
    }

    async function missionSnapshot() {
      const result = await get('/mission');
      if (!result.response.ok) {
        const error = new Error('mission_snapshot_unavailable');
        error.status = result.response.status;
        throw error;
      }
      return result.payload;
    }

    async function submitIntent(request = {}) {
      let auth = authEnvelope();
      if (!auth) {
        await register();
        auth = authEnvelope();
      }
      if (!auth) {
        return { ok: false, status: 'blocked', error: 'cockpit_session_unavailable', sideEffect: false };
      }
      const submit = async value => {
        const result = await post('/mission/intents', Object.assign({}, value, auth));
        return result.payload || {
          ok: false,
          status: 'error',
          error: `mission_intent_http_${result.response.status}`,
          sideEffect: false
        };
      };
      const first = await submit(request);
      const retryable = first && (first.error === 'mission_revision_conflict'
        || first.error === 'mission_intent_not_allowed_in_state'
        || first.error === 'mission_run_conflict');
      if (!retryable) return first;
      try {
        const latest = await missionSnapshot();
        const control = latest && latest.control && typeof latest.control === 'object' ? latest.control : null;
        const allowed = control && Array.isArray(control.allowedActions) ? control.allowedActions : [];
        const intent = String(request.intent || request.action || '').toLowerCase();
        if (!control || control.executionAuthority !== 'tracker'
            || String(control.missionId || '') !== String(request.missionId || '')
            || (allowed.indexOf(intent) < 0 && intent !== 'close_cargo_window')) {
          return first;
        }
        return submit(Object.assign({}, request, {
          commandId: `${String(request.commandId || 'intent')}:retry:${Date.now()}`,
          missionId: control.missionId,
          runId: control.runId,
          expectedRevision: Number(control.authorityRevision || 0)
        }));
      } catch (_) {
        return first;
      }
    }

    return Object.freeze({
      authEnvelope,
      baseUrl,
      clientId,
      get session() { return session ? Object.assign({}, session) : null; },
      heartbeat,
      missionSnapshot,
      pollVoice,
      register,
      role,
      start: register,
      stop,
      stopVoice,
      unlockAudioPlayback,
      submitIntent
    });
  }

  function inferRole(script) {
    const explicit = String(script && script.dataset && script.dataset.role || '').trim().toLowerCase();
    if (['web', 'efb', 'toolbar'].includes(explicit)) return explicit;
    try {
      const host = new URLSearchParams(runtime.location && runtime.location.search || '').get('host');
      if (host === 'toolbar') return 'toolbar';
      if (String(runtime.location && runtime.location.pathname || '').startsWith('/efb/')) return 'efb';
    } catch (_) {}
    return 'web';
  }

  function autoStart(script) {
    if (typeof runtime.document === 'undefined') return null;
    const role = inferRole(script);
    installAudioPreferenceFallback(role);
    const client = createClient({
      role,
      appVersion: String(script && script.dataset && script.dataset.appVersion || ''),
      capabilities: ['cockpit.session.v1', 'mission.snapshot.v2', 'voice.playback.v1'],
      listenForVoice: () => role !== 'web'
        || (typeof runtime.gaTrackerExecutionHandlesMission === 'function'
          && runtime.gaTrackerExecutionHandlesMission() === true),
      getAudioPlaybackEnabled: () => typeof runtime.awmShouldPlayOnThisDevice === 'function'
        ? runtime.awmShouldPlayOnThisDevice() === true
        : false
    });
    runtime.gaCockpitSessionClient = client;
    client.start().catch(() => {});
    client.pollVoice().catch(() => {});
    if (typeof runtime.addEventListener === 'function') {
      runtime.addEventListener('ga:audio-playback-device-changed', () => client.heartbeat().catch(() => {}));
      var unlockFromGesture = function () {
        if (typeof runtime.awmShouldPlayOnThisDevice === 'function' && runtime.awmShouldPlayOnThisDevice() === true) {
          client.unlockAudioPlayback().catch(() => {});
        }
      };
      runtime.addEventListener('pointerdown', unlockFromGesture, true);
      runtime.addEventListener('touchend', unlockFromGesture, true);
      runtime.addEventListener('keydown', unlockFromGesture, true);
      runtime.addEventListener('pagehide', () => client.stop().catch(() => {}), { once: true });
    }
    return client;
  }

  function installAudioPreferenceFallback(role = 'web') {
    if (typeof runtime.document === 'undefined') return;
    if (typeof runtime.awmShouldPlayOnThisDevice !== 'function') {
      let enabled = true;
      try { enabled = !runtime.localStorage || runtime.localStorage.getItem('awm_play_on_this_device') !== '0'; } catch (_) {}
      runtime.awmShouldPlayOnThisDevice = () => enabled;
      runtime.awmSyncPlaybackDeviceControls = () => {
        const checkbox = runtime.document.getElementById('awmPlayOnThisDeviceCheck');
        const status = runtime.document.getElementById('awmPlayOnThisDeviceStatus');
        if (checkbox) checkbox.checked = enabled;
        if (status) {
          status.textContent = enabled
            ? 'Diese Instanz darf zentrale Ansagen übernehmen.'
            : 'Diese Instanz bleibt synchron, gibt aber kein Audio aus.';
          status.style.color = enabled ? '#8294a8' : '#d7a65a';
        }
      };
      runtime.awmSetPlayOnThisDevice = value => {
        enabled = value === true;
        try { if (runtime.localStorage) runtime.localStorage.setItem('awm_play_on_this_device', enabled ? '1' : '0'); } catch (_) {}
        if (!enabled && runtime.gaCockpitSessionClient && typeof runtime.gaCockpitSessionClient.stopVoice === 'function') {
          runtime.gaCockpitSessionClient.stopVoice(false).catch(() => {});
        }
        if (enabled && runtime.gaCockpitSessionClient && typeof runtime.gaCockpitSessionClient.unlockAudioPlayback === 'function') {
          runtime.gaCockpitSessionClient.unlockAudioPlayback().catch(() => {});
        }
        runtime.awmSyncPlaybackDeviceControls();
        try { runtime.dispatchEvent(new runtime.CustomEvent('ga:audio-playback-device-changed', { detail: { enabled } })); } catch (_) {}
      };
    }
    if (typeof runtime.awmSetVolume !== 'function') {
      runtime.awmSetVolume = value => {
        const volume = Math.max(0, Math.min(1, Number(value) / 100));
        try { if (runtime.localStorage) runtime.localStorage.setItem('awm_volume', String(volume)); } catch (_) {}
        const label = runtime.document.getElementById('awmVolumeLabel');
        if (label) label.textContent = `${Math.round(volume * 100)}%`;
      };
    }
    if (typeof runtime.toggleMapVoiceMenu !== 'function') {
      runtime.toggleMapVoiceMenu = () => {
        const menu = runtime.document.getElementById('mapVoiceMenu');
        const button = runtime.document.getElementById('mapVoiceBtn');
        if (!menu) return;
        const open = menu.style.display !== 'block';
        menu.style.display = open ? 'block' : 'none';
        if (button && typeof button.setAttribute === 'function') button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (typeof runtime.awmSyncPlaybackDeviceControls === 'function') runtime.awmSyncPlaybackDeviceControls();
      };
    }
    if (typeof runtime.awmSyncPlaybackDeviceControls === 'function') runtime.awmSyncPlaybackDeviceControls();
  }

  const api = Object.freeze({
    CLIENT_ID_STORAGE_KEY,
    DEFAULT_BASE_URL,
    autoStart,
    createClient,
    requestJson,
    inferRole,
    installAudioPreferenceFallback
  });

  if (typeof runtime.document !== 'undefined') autoStart(runtime.document.currentScript);
  return api;
});
