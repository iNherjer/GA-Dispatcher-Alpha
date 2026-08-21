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
    const clientId = String(options.clientId || storedClientId(role)).trim().slice(0, 220);
    const fetchRemote = typeof options.fetchRemote === 'function' ? options.fetchRemote : runtime.fetch;
    const getAudioPlaybackEnabled = typeof options.getAudioPlaybackEnabled === 'function'
      ? options.getAudioPlaybackEnabled
      : () => options.audioPlaybackEnabled === true;
    const listenForVoice = typeof options.listenForVoice === 'function'
      ? options.listenForVoice
      : () => options.listenForVoice === true;
    let session = null;
    let sessionToken = '';
    let heartbeatTimer = null;
    let voiceTimer = null;
    let activeVoice = null;
    const voiceCooldowns = new Map();
    let stopped = false;

    async function post(pathname, payload, keepalive = false) {
      if (typeof fetchRemote !== 'function') throw new Error('fetch_unavailable');
      const response = await fetchRemote(`${baseUrl}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
        cache: 'no-store',
        keepalive
      });
      let body = null;
      try { body = await response.json(); } catch (_) {}
      return { response, payload: responsePayload(body) };
    }

    async function get(pathname) {
      if (typeof fetchRemote !== 'function') throw new Error('fetch_unavailable');
      const response = await fetchRemote(`${baseUrl}${pathname}`, {
        method: 'GET',
        cache: 'no-store'
      });
      let body = null;
      try { body = await response.json(); } catch (_) {}
      return { response, payload: responsePayload(body) };
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
        await post('/voice/playback/release', { effectId, clientId, completed: completed === true });
      } catch (_) {}
    }

    async function stopVoice(completed = false) {
      const current = activeVoice;
      activeVoice = null;
      if (!current) return;
      for (const audio of [current.cueAudio, current.audio].filter(Boolean)) {
        try { audio.onended = null; audio.onerror = null; } catch (_) {}
        try { audio.pause(); } catch (_) {}
        try { audio.currentTime = 0; } catch (_) {}
      }
      await releaseVoice(current.effectId, completed);
    }

    async function playVoiceJob(job) {
      const jobSource = job && typeof job === 'object' ? job : {};
      const effectId = String(jobSource.effectId || '').trim();
      if (!effectId || activeVoice || getAudioPlaybackEnabled() !== true) return false;
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
      const AudioCtor = options.Audio || runtime.Audio;
      if (typeof AudioCtor !== 'function') {
        await releaseVoice(effectId, false);
        return false;
      }
      const audio = new AudioCtor(`${baseUrl}/voice/jobs/${encodeURIComponent(effectId)}/audio`);
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
        const storedVolume = typeof runtime.document !== 'undefined' && runtime.localStorage
          ? Number(runtime.localStorage.getItem('awm_volume'))
          : NaN;
        masterVolume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(1, storedVolume)) : 1;
        audio.volume = masterVolume;
        if (cueAudio) cueAudio.volume = Math.max(0, Math.min(1, masterVolume * (Number(cue.gain) || 0.38)));
      } catch (_) {}
      activeVoice = { effectId, audio, cueAudio };
      let finished = false;
      let voiceStarted = false;
      const finish = async (completed) => {
        if (finished) return;
        finished = true;
        if (activeVoice && activeVoice.audio === audio) activeVoice = null;
        for (const item of [cueAudio, audio].filter(Boolean)) {
          try { item.onended = null; item.onerror = null; } catch (_) {}
        }
        if (!completed) voiceCooldowns.set(effectId, Date.now() + 10000);
        await releaseVoice(effectId, completed);
        scheduleVoice(completed ? 250 : 1500);
      };
      audio.onended = () => finish(true).catch(() => {});
      audio.onerror = () => finish(false).catch(() => {});
      const startVoice = async () => {
        if (voiceStarted || finished) return true;
        voiceStarted = true;
        try {
          await audio.play();
          return true;
        } catch (_) {
          await finish(false);
          return false;
        }
      };
      if (cueAudio) {
        cueAudio.onended = () => startVoice().catch(() => {});
        cueAudio.onerror = () => startVoice().catch(() => {});
      }
      try {
        if (cueAudio) await cueAudio.play();
        else await startVoice();
        return true;
      } catch (_) {
        return startVoice();
      }
    }

    async function pollVoice() {
      if (stopped) return;
      if (listenForVoice() !== true || !session || !session.sessionId || getAudioPlaybackEnabled() !== true || activeVoice) {
        scheduleVoice(activeVoice ? 500 : 1200);
        return;
      }
      try {
        const result = await fetchRemote(`${baseUrl}/voice/playback/next`, { cache: 'no-store' });
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
      if (!session || !session.sessionId || !sessionToken) return register();
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
      const result = await post('/mission/intents', Object.assign({}, request, auth));
      return result.payload || {
        ok: false,
        status: 'error',
        error: `mission_intent_http_${result.response.status}`,
        sideEffect: false
      };
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
    if (typeof runtime.addEventListener === 'function') {
      runtime.addEventListener('ga:audio-playback-device-changed', () => client.heartbeat().catch(() => {}));
      runtime.addEventListener('pagehide', () => client.stop().catch(() => {}), { once: true });
    }
    return client;
  }

  function installAudioPreferenceFallback(role = 'web') {
    if (typeof runtime.document === 'undefined') return;
    if (typeof runtime.awmShouldPlayOnThisDevice !== 'function') {
      let enabled = false;
      try { enabled = runtime.localStorage && runtime.localStorage.getItem('awm_play_on_this_device') === '1'; } catch (_) {}
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
    inferRole,
    installAudioPreferenceFallback
  });

  if (typeof runtime.document !== 'undefined') autoStart(runtime.document.currentScript);
  return api;
});
