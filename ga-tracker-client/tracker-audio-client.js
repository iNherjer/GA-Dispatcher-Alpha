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
  var state = null, enabled = false, menu = null, saving = Promise.resolve(), closed = false, lastError = '', volumeTimer = null;
  var base = cockpit.baseUrl, captionEffect = '';
  function caption(job) {
    if (!job || captionEffect === job.effectId) return;
    captionEffect = job.effectId;
    root.dispatchEvent(new root.CustomEvent('ga:tracker-voice-playback', { detail: job }));
  }
  async function request(payload) {
    payload = Object.assign({}, payload, { deviceId: deviceId, clientId: cockpit.clientId });
    if (!local) return root.gaTrackerAudioRelayRequest(payload);
    var response = await root.fetch(base + '/audio/playback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Tracker nicht erreichbar.');
    return result;
  }
  async function fetchClip(job, stage) {
    var url = base + '/voice/jobs/' + encodeURIComponent(job.effectId) + '/' + stage;
    var asset = String(job.cue && job.cue.assetName || '');
    if (!local && stage === 'cue' && /^[a-zA-Z0-9_-]+\.mp3$/.test(asset)) {
      url = 'https://inherjer.github.io/GA-Dispatcher-Alpha/audio-cues/' + asset;
    } else if (!local) {
      var part = await request({ action: stage, effectId: job.effectId, offset: 0 });
      if (!Number.isSafeInteger(part.total) || part.total < 1 || part.total > 8 * 1024 * 1024) throw new Error('Ungültige Audiodaten.');
      var bytes = new Uint8Array(part.total), offset = 0;
      while (true) {
        if (part.offset !== offset || part.total !== bytes.length) throw new Error('Unvollständige Audiodaten.');
        var decoded = root.atob(part.data);
        if (!decoded.length || offset + decoded.length > bytes.length) throw new Error('Ungültige Audiodaten.');
        for (var i = 0; i < decoded.length; i++) bytes[offset + i] = decoded.charCodeAt(i);
        offset += decoded.length;
        if (offset === bytes.length) return bytes.buffer;
        part = await request({ action: stage, effectId: job.effectId, offset: offset });
      }
    }
    var response = await root.fetch(url, { cache: stage === 'cue' ? 'force-cache' : 'no-store' });
    if (!response.ok) throw new Error('Audio konnte nicht geladen werden.');
    return response.arrayBuffer();
  }
  function message(text) { var item = root.document.getElementById('gaAudioOutputStatus'); if (item) item.textContent = text; }
  var player = root.GATrackerAudioPlayer.createPlayer({ deviceId: deviceId, clientId: cockpit.clientId,
    request: request, fetchClip: fetchClip, AudioContext: root.AudioContext || root.webkitAudioContext,
    onError: function (error) { lastError = error; message(error); }, onPlayback: function (job) {
      if (job) lastError = '';
      if (job) caption(job);
    } });
  function isActive() { return !!state && (local || (typeof root.gaTrackerExecutionHandlesMission === 'function' && root.gaTrackerExecutionHandlesMission())); }
  function apply(value) {
    if (value && value.schema !== 'ga.audio-control.v1') return;
    if (value && state && value.updatedAt < state.updatedAt) return;
    state = value;
    enabled = isActive();
    player.update(enabled ? state : null);
    if (enabled && state.playback) caption(state.playback.nowPlaying);
    render();
  }
  function change(patch) {
    lastError = '';
    saving = saving.catch(function () {}).then(async function () {
      if (!state) return;
      var result = await request(Object.assign({}, patch, { action: 'settings_update', expectedRevision: state.revision }));
      if (result.audio) apply(Object.assign({}, result.audio, { playback: state.playback }));
      if (!result.ok) throw new Error(result.error === 'audio_revision_conflict' ? 'Audioeinstellung wurde auf einem anderen Gerät geändert. Bitte erneut wählen.' : 'Audioeinstellung konnte nicht gespeichert werden.');
    }).catch(function (error) { lastError = error.message; render(); });
    return saving;
  }
  function installMenu() {
    var host = root.document.getElementById('mapVoiceMenu');
    if (!host || menu) return;
    menu = root.document.createElement('div'); menu.id = 'gaTrackerAudioOutput';
    menu.style.cssText = 'padding:6px 2px 10px;margin-bottom:8px;border-bottom:1px solid #444;';
    var label = root.document.createElement('label'); label.textContent = 'Audioausgabe ';
    var select = root.document.createElement('select'); select.id = 'gaAudioOutputSelect'; select.style.cssText = 'width:100%;padding:6px;background:#1a2a3a;color:#d0e8ff;border:1px solid #456;border-radius:5px';
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
  }
  var bindings = { awmSetVolume: ['volume', function (v) { return Number(v) / 100; }],
    paxVoiceSetEnabled: ['paxEnabled', Boolean], paxVoiceSetAudioEffectsEnabled: ['effectsEnabled', Boolean] };
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
    [['awmPaxVoiceCheck','paxEnabled'],['awmAudioEffectsCheck','effectsEnabled']].forEach(function (entry) { var el = root.document.getElementById(entry[0]); if (el) el.checked = state.settings[entry[1]]; });
    var slider = root.document.getElementById('awmVolumeSlider'), label = root.document.getElementById('awmVolumeLabel');
    if (slider && root.document.activeElement !== slider) slider.value = Math.round(state.settings.volume * 100);
    if (label) label.textContent = Math.round(state.settings.volume * 100) + '%';
  }
  root.gaTrackerAudioClient = { active: isActive, deviceId: deviceId, apply: apply, change: change };
  root.addEventListener('ga:tracker-audio-state', function (event) { apply(event.detail); });
  root.addEventListener('pointerdown', function () { if (isActive() && state.target.deviceId === deviceId) player.unlock().then(function () { player.pump(); }); }, true);
  async function tick() {
    if (closed) return;
    if (local) {
      try { var response = await root.fetch(base + '/audio/settings', { cache: 'no-store' }); if (response.ok) apply((await response.json()).audio); else apply(null); } catch (_) { apply(null); }
    } else {
      enabled = isActive(); player.update(enabled ? state : null); render();
    }
    if (!closed) setTimeout(tick, 1000);
  }
  root.addEventListener('pagehide', function () { closed = true; clearTimeout(volumeTimer); player.stop(); }, { once: true });
  tick();
})(typeof window !== 'undefined' ? window : {});
