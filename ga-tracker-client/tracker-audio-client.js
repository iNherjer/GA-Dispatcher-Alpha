(function (root) {
  'use strict';
  if (!root.document || !root.GATrackerAudioPlayer || !root.gaCockpitSessionClient) return;
  var cockpit = root.gaCockpitSessionClient, local = cockpit.role !== 'web';
  var deviceId;
  try {
    deviceId = root.localStorage.getItem('ga_audio_device_id_v1');
    if (!deviceId) {
      deviceId = 'app-' + (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
      root.localStorage.setItem('ga_audio_device_id_v1', deviceId);
    }
  } catch (_) { deviceId = cockpit.clientId; }
  var retiredWarningSessions = [], styleMigration = false;
  var state = null, enabled = false, menu = null, saving = Promise.resolve(), closed = false, lastError = '', volumeTimer = null, tickTimer = null, lifecycleEpoch = 0;
  var base = cockpit.baseUrl, captionEffect = '';
  function caption(job) {
    if (job && (job.clips || ['airspace', 'terrain', 'waypoint'].indexOf(job.kind) >= 0)) return;
    if (!job || captionEffect === job.effectId) return;
    captionEffect = job.effectId;
    root.dispatchEvent(new root.CustomEvent('ga:tracker-voice-playback', { detail: job }));
  }
  async function request(payload) {
    payload = Object.assign({}, payload, { deviceId: deviceId, clientId: cockpit.clientId });
    if (!local) return root.gaTrackerAudioRelayRequest(payload);
    var result = await root.GATrackerCockpitSessionClient.requestJson(root.fetch.bind(root), base + '/audio/playback',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 2500);
    if (!result.response.ok) throw new Error(result.body.error || 'Tracker nicht erreichbar.');
    return result.body;
  }
  async function fetchClip(job, stage, signal, pack) {
    function checkCancelled() { if (signal && signal.aborted) throw new Error('audio_download_cancelled'); }
    checkCancelled();
    if (job.clips && /^warning:/.test(stage)) {
      var key = job.clips[Number(stage.split(':')[1])], core = root.GANavigationWarningAudio;
      if (key === 'taws-whoop') return core.whoopWav();
      async function asset(clip) {
        var assetPath = core.assetPath(clip, pack), address = local ? base + '/audio/assets/' + encodeURIComponent(assetPath)
          : 'https://inherjer.github.io/GA-Dispatcher-Alpha/' + assetPath;
        var result = await root.fetch(address, { cache: 'force-cache', signal: signal });
        if (!result.ok) throw new Error('Warnclip konnte nicht geladen werden.');
        return result.arrayBuffer();
      }
      try { return await asset(key); }
      catch (error) { if (key === 'aw-zwo') return asset('aw-d2'); throw error; }
    }
    var url = base + '/voice/jobs/' + encodeURIComponent(job.effectId) + '/' + stage;
    var asset = String(job.cue && job.cue.assetName || '');
    if (!local && stage === 'cue' && /^[a-zA-Z0-9_-]+\.mp3$/.test(asset)) {
      url = 'https://inherjer.github.io/GA-Dispatcher-Alpha/audio-cues/' + asset;
    } else if (!local) {
      var part = await request({ action: stage, effectId: job.effectId, offset: 0 });
      if (!Number.isSafeInteger(part.total) || part.total < 1 || part.total > 8 * 1024 * 1024) throw new Error('Ungültige Audiodaten.');
      var bytes = new Uint8Array(part.total);
      function copy(chunk, expectedOffset) {
        checkCancelled();
        if (chunk.offset !== expectedOffset || chunk.total !== bytes.length) throw new Error('Unvollständige Audiodaten.');
        var decoded = root.atob(chunk.data);
        if (decoded.length !== Math.min(24 * 1024, bytes.length - expectedOffset)) throw new Error('Ungültige Audiodaten.');
        for (var i = 0; i < decoded.length; i++) bytes[expectedOffset + i] = decoded.charCodeAt(i);
      }
      copy(part, 0);
      // Bound concurrency: avoid one complete relay round trip for every 24 KiB.
      for (var offset = 24 * 1024; offset < bytes.length; offset += 4 * 24 * 1024) {
        checkCancelled();
        var batch = [];
        for (var index = 0; index < 4 && offset + index * 24 * 1024 < bytes.length; index++) {
          (function (chunkOffset) {
            batch.push(request({ action: stage, effectId: job.effectId, offset: chunkOffset }).then(function (chunk) { copy(chunk, chunkOffset); }));
          })(offset + index * 24 * 1024);
        }
        await Promise.all(batch);
      }
      return bytes.buffer;
    }
    var response = await root.fetch(url, { cache: stage === 'cue' ? 'force-cache' : 'no-store', signal: signal });
    if (!response.ok) throw new Error('Audio konnte nicht geladen werden.');
    return response.arrayBuffer();
  }
  function message(text) { var item = root.document.getElementById('gaAudioOutputStatus'); if (item) item.textContent = text; }
  function createPlayer() { return root.GATrackerAudioPlayer.createPlayer({ deviceId: deviceId, clientId: cockpit.clientId,
    request: request, fetchClip: fetchClip, AudioContext: root.AudioContext || root.webkitAudioContext,
    onError: function (error) { lastError = error; message(error); }, onPlayback: function (job) {
      if (job) lastError = '';
      if (job) caption(job);
    } }); }
  var player = createPlayer();
  function isActive() { return !!state && (local || !!(state.warnings && state.warnings.active) || (typeof root.gaTrackerExecutionHandlesMission === 'function' && root.gaTrackerExecutionHandlesMission())); }
  function apply(value) {
    if (value && value.schema !== 'ga.audio-control.v1') return;
    if (value && state && value.updatedAt < state.updatedAt) return;
    if (value && value.warnings && state && state.warnings && value.warnings.session !== state.warnings.session) {
      if (retiredWarningSessions.indexOf(value.warnings.session) >= 0) value = Object.assign({}, value, { warnings: state.warnings });
      else { retiredWarningSessions.push(state.warnings.session); retiredWarningSessions = retiredWarningSessions.slice(-8); }
    }
    if (value && value.warnings && state && state.warnings
        && value.warnings.session === state.warnings.session && value.warnings.revision < state.warnings.revision) {
      value = Object.assign({}, value, { warnings: state.warnings });
    }
    if (value && value.warnings && value.warnings.active && !(state && state.warnings && state.warnings.active)
        && typeof root.awmStopLocalWarnings === 'function') root.awmStopLocalWarnings();
    state = value;
    if (state && Object.prototype.hasOwnProperty.call(state.settings, 'audioStyle') && !state.settings.audioStyle && !local && !styleMigration) {
      styleMigration = true;
      var savedStyle = 'intercom_noise';
      try { savedStyle = root.localStorage.getItem('awm_pax_audio_style') || savedStyle; } catch (_) {}
      if (['clear', 'intercom', 'intercom_noise'].indexOf(savedStyle) < 0) savedStyle = 'intercom_noise';
      var migrated = { audioStyle: savedStyle };
      if (state.revision === 0) {
        [['awm_warn_terrain','terrain'],['awm_warn_airspace','airspace'],['awm_read_freq','readFreq'],['awm_warn_wp','waypoint'],['awm_pax_voice','paxEnabled'],['awm_audio_effects','effectsEnabled']].forEach(function(entry) {
          try { var value = root.localStorage.getItem(entry[0]); if (value !== null) migrated[entry[1]] = value === '1'; } catch (_) {}
        });
      }
      change({ settings: migrated }).then(function() {
        if (!state || !state.settings.audioStyle) styleMigration = false;
      });
    }
    enabled = isActive();
    player.update(enabled ? state : null);
    if (enabled && state.playback) caption(state.playback.nowPlaying);
    displayWarnings(value && value.warnings);
    render();
  }
  function change(patch) {
    lastError = '';
    saving = saving.catch(function () {}).then(async function () {
      if (!state) return;
      var epoch = lifecycleEpoch;
      var result = await request(Object.assign({}, patch, { action: 'settings_update', expectedRevision: state.revision }));
      if (closed || epoch !== lifecycleEpoch) return;
      if (result.audio) apply(Object.assign({}, result.audio, { playback: state && state.playback, warnings: state && state.warnings }));
      if (!result.ok) throw new Error(result.error === 'audio_revision_conflict' ? 'Audioeinstellung wurde auf einem anderen Gerät geändert. Bitte erneut wählen.' : 'Audioeinstellung konnte nicht gespeichert werden.');
    }).catch(function (error) { lastError = error.message; render(); });
    return saving;
  }
  function installMenu() {
    var host = root.document.getElementById('mapVoiceMenu');
    if (!host || menu) return;
    menu = root.document.createElement('div'); menu.id = 'gaTrackerAudioOutput';
    menu.style.cssText = 'box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere;padding:6px 2px 10px;margin-bottom:8px;border-bottom:1px solid #444;';
    var label = root.document.createElement('label'); label.textContent = 'Audioausgabe ';
    var select = root.document.createElement('select'); select.id = 'gaAudioOutputSelect'; select.style.cssText = 'box-sizing:border-box;min-width:0;max-width:100%;width:100%;padding:6px;background:#1a2a3a;color:#d0e8ff;border:1px solid #456;border-radius:5px';
    [['pc','PC'],['this','Diese App'],['other','Andere App']].forEach(function (entry) { var option = root.document.createElement('option'); option.value = entry[0]; option.textContent = entry[1]; option.disabled = entry[0] === 'other'; select.appendChild(option); });
    select.onchange = function () {
      if (select.value === 'this') player.unlock();
      change({ target: select.value === 'pc' ? { mode: 'pc' } : { mode: 'app', deviceId: deviceId, name: local ? 'EFB' : 'App (' + (root.navigator.platform || 'Browser') + ')' } });
    };
    label.appendChild(select); menu.appendChild(label);
    var status = root.document.createElement('div'); status.id = 'gaAudioOutputStatus'; status.style.cssText = 'font-size:11px;margin-top:5px;color:#a6b7c8'; status.setAttribute('role','status'); menu.appendChild(status);
    var muteLabel = root.document.createElement('label'); muteLabel.style.cssText = 'display:block;margin-top:6px';
    var mute = root.document.createElement('input'); mute.type = 'checkbox'; mute.id = 'gaAudioMasterEnabled';
    mute.onchange = function () { change({ settings: { enabled: mute.checked } }); };
    muteLabel.appendChild(mute); muteLabel.appendChild(root.document.createTextNode(' Audio aktiviert')); menu.appendChild(muteLabel);
    host.insertBefore(menu, host.firstChild);
    // The EFB uses the shared markup without the App's inline voice-list builder.
    var voices = local && root.document.getElementById('awmVoiceList');
    if (voices) {
      var packs = root.document.createElement('select'); packs.id = 'gaWarningVoiceSelect';
      packs.style.cssText = select.style.cssText;
      packs.setAttribute('aria-label', 'Warnstimme');
      function option(id, text) { var item = root.document.createElement('option'); item.value = id; item.textContent = text; packs.appendChild(item); }
      option('', 'Anna (DE)'); voices.replaceChildren(packs);
      packs.onchange = function() { change({ settings: { voicePack: packs.value } }); };
      root.fetch('/efb/v1/assets/warning-voices.json').then(function(response) { if (!response.ok) throw new Error('voice_catalog_unavailable'); return response.json(); })
        .then(function(catalog) { (catalog.packs || []).forEach(function(p) { if (/^[a-z0-9-]+$/.test(p.id)) option(p.id, p.label); }); render(); }).catch(function() {});
    }
  }
  var bindings = { awmSetVolume: ['volume', function (v) { return Number(v) / 100; }],
    paxVoiceSetAudioStyle: ['audioStyle', String], paxVoiceSetEnabled: ['paxEnabled', Boolean], paxVoiceSetAudioEffectsEnabled: ['effectsEnabled', Boolean] };
  Object.assign(bindings, { awmSetVoice: ['voicePack', String], awmSetReadFreq: ['readFreq', Boolean],
    awmSetTerrainWarn: ['terrain', Boolean], awmSetAirspaceWarn: ['airspace', Boolean], awmSetWpAlert: ['waypoint', Boolean] });
  var seenWarnings = new Set(), warningGeometry = new Map();
  async function highlightWarning(warning) {
    var previous = warningGeometry.get(warning.id);
    if (previous === true || previous > Date.now() || typeof root.awmHighlightTrackerAirspace !== 'function') return;
    warningGeometry.set(warning.id, true);
    try {
      var data = '', total = null;
      do {
        var chunk = await request({ action: 'warning_geometry', effectId: warning.id, offset: data.length });
        if (chunk.offset !== data.length || !Number.isSafeInteger(chunk.total) || chunk.total < 1 || chunk.total > 4 * 1024 * 1024
            || (total !== null && total !== chunk.total) || typeof chunk.data !== 'string' || !chunk.data.length
            || chunk.data.length > 12000 || data.length + chunk.data.length > chunk.total) throw new Error('warning_geometry_invalid');
        total = chunk.total; data += chunk.data;
      } while (data.length < total);
      if (warning.expiresAt < Date.now() || !root.gaTrackerWarningsActive()) return;
      if (root.awmHighlightTrackerAirspace(Object.assign({}, warning.airspace, { geometry: JSON.parse(data) })) === false) warningGeometry.delete(warning.id);
    } catch (_) { warningGeometry.set(warning.id, Date.now() + 5000); }
    while (warningGeometry.size > 32) warningGeometry.delete(warningGeometry.keys().next().value);
  }
  function displayWarnings(snapshot) {
    if (!snapshot || snapshot.schema !== 'ga.navigation-warnings.v1' || !snapshot.active) return;
    (snapshot.events || []).forEach(function(warning) {
      if (warning.expiresAt < Date.now()) return;
      if (!seenWarnings.has(warning.id)) {
        if (typeof root.awmDisplayTrackerWarning !== 'function' || root.awmDisplayTrackerWarning(warning) === false) return;
        seenWarnings.add(warning.id);
        if (seenWarnings.size > 128) seenWarnings.delete(seenWarnings.values().next().value);
      }
      if (warning.kind === 'airspace' && warning.hasGeometry) highlightWarning(warning);
    });
  }
  root.gaTrackerWarningsActive = function() { return !root.simModeActive && !!(state && state.warnings && state.warnings.active && state.warnings.schema === 'ga.navigation-warnings.v1'); };
  var originals = {};
  Object.keys(bindings).forEach(function (name) {
    originals[name] = root[name];
    root[name] = function (value) {
      if (!isActive()) return typeof originals[name] === 'function' ? originals[name].apply(this, arguments) : undefined;
      var settings = {}; settings[bindings[name][0]] = bindings[name][1](value);
      if (name === 'awmSetVolume') {
        // Keep the existing local warning gain in sync while warning triggers remain in the App.
        if (typeof originals[name] === 'function') originals[name](value);
        clearTimeout(volumeTimer); volumeTimer = setTimeout(function () { change({ settings: settings }); }, 200); return; }
      return change({ settings: settings });
    };
  });
  function render() {
    installMenu(); if (!menu) return;
    menu.style.display = state ? 'block' : 'none';
    var old = root.document.getElementById('awmPlayOnThisDeviceCheck');
    if (old && old.parentNode) old.parentNode.style.display = enabled ? 'none' : 'flex';
    var oldStatus = root.document.getElementById('awmPlayOnThisDeviceStatus'); if (oldStatus) oldStatus.style.display = enabled ? 'none' : '';
    if (!state) return;
    root.document.getElementById('gaAudioOutputSelect').value = state.target.mode === 'pc' ? 'pc' : state.target.deviceId === deviceId ? 'this' : 'other';
    root.document.getElementById('gaAudioMasterEnabled').checked = state.settings.enabled;
    message(lastError || 'Ausgabe: ' + state.target.name + (state.cloudState === 'pending' ? ' · Cloud-Speicherung ausstehend' : ''));
    if (!enabled) return;
    if (state.warnings && ['partial','stale'].indexOf(state.warnings.status) >= 0) message('Ausgabe: ' + state.target.name + ' · ' + (state.warnings.health || 'Warnungsdaten veraltet'));
    // Keep standalone state/diagnostics aligned with the authoritative toggles,
    // without starting another warning detector or changing the selected output.
    [['awmSetTerrainWarn','terrain','awm_warn_terrain'],['awmSetAirspaceWarn','airspace','awm_warn_airspace'],['awmSetReadFreq','readFreq','awm_read_freq'],['awmSetWpAlert','waypoint','awm_warn_wp']].forEach(function(entry) {
      try { if (typeof originals[entry[0]] === 'function' && root.localStorage.getItem(entry[2]) !== (state.settings[entry[1]] ? '1' : '0')) originals[entry[0]](state.settings[entry[1]]); } catch (_) {}
    });
    var styleSelect = root.document.getElementById('awmPaxAudioStyleSelect');
    if (styleSelect) styleSelect.value = state.settings.audioStyle || 'intercom_noise';
    var packs = root.document.getElementById('gaWarningVoiceSelect'); if (packs) packs.value = state.settings.voicePack || '';
    root.document.querySelectorAll('[id^="awmVoiceBtn_"]').forEach(function(btn) {
      var selected = btn.id === 'awmVoiceBtn_' + (state.settings.voicePack || 'anna');
      btn.style.border = '1px solid ' + (selected ? '#4da6ff' : '#444');
      btn.style.background = selected ? '#1a3a5c' : '#1e1e1e'; btn.style.color = selected ? '#4da6ff' : '#ccc';
    });
    [['awmPaxVoiceCheck','paxEnabled'],['awmAudioEffectsCheck','effectsEnabled'],['awmReadFreqCheck','readFreq'],['awmTerrainWarnCheck','terrain'],['awmAirspaceWarnCheck','airspace'],['awmWpAlertCheck','waypoint']].forEach(function (entry) { var el = root.document.getElementById(entry[0]); if (el) el.checked = state.settings[entry[1]]; });
    var slider = root.document.getElementById('awmVolumeSlider'), label = root.document.getElementById('awmVolumeLabel');
    if (slider && root.document.activeElement !== slider) slider.value = Math.round(state.settings.volume * 100);
    if (label) label.textContent = Math.round(state.settings.volume * 100) + '%';
  }
  root.gaTrackerAudioClient = { active: isActive, deviceId: deviceId, apply: apply, change: change };
  root.addEventListener('gatrackercapabilitieschange', function(event) {
    var caps = event.detail && event.detail.capabilities;
    if (state && state.warnings && caps && caps.length && caps.indexOf('navigation.warnings.v1') < 0) {
      apply(Object.assign({}, state, { warnings: null }));
    }
  });
  root.addEventListener('ga:tracker-audio-state', function (event) { apply(event.detail); });
  function unlockFromGesture() {
    // Unlock on the initiating touch, before an asynchronous mission handoff.
    if (!closed && state && state.target.deviceId === deviceId) {
      player.unlock().then(function () { if (isActive()) player.pump(); });
    }
  }
  root.addEventListener('pointerdown', unlockFromGesture, true);
  root.addEventListener('touchend', unlockFromGesture, true);
  root.addEventListener('click', unlockFromGesture, true);
  async function tick() {
    if (closed) return;
    var epoch = lifecycleEpoch;
    if (local) {
      try {
        var result = await root.GATrackerCockpitSessionClient.requestJson(root.fetch.bind(root), base + '/audio/settings', { cache: 'no-store' }, 2500);
        var value = result.response.ok ? result.body.audio : null;
        if (!closed && epoch === lifecycleEpoch) apply(value);
      } catch (_) { if (!closed && epoch === lifecycleEpoch) apply(null); }
    } else {
      enabled = isActive(); player.update(enabled ? state : null); render();
    }
    if (!closed && epoch === lifecycleEpoch) tickTimer = setTimeout(tick, 1000);
  }
  root.addEventListener('pagehide', function () {
    closed = true; lifecycleEpoch++; clearTimeout(volumeTimer); clearTimeout(tickTimer);
    player.stop();
  });
  root.addEventListener('pageshow', function () {
    if (!closed) return;
    closed = false;
    player = createPlayer();
    tick();
  });
  tick();
})(typeof window !== 'undefined' ? window : {});
