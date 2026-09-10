(function () {
  'use strict';
  const api = window.trackerDesktop;
  const $ = id => document.getElementById(id);
  let audio = null, outputId = '', stopped = false, saving = Promise.resolve(), playbackText = '', lastError = '';
  const clientId = 'desktop-audio-' + crypto.randomUUID();
  const player = window.GATrackerAudioPlayer.createPlayer({ deviceId: 'pc', clientId,
    AudioContext: window.AudioContext, getOutputDeviceId: () => outputId,
    request: payload => api.audioRequest('playback', payload),
    fetchClip: async (job, stage, signal, pack) => {
      let bytes;
      if (job.clips && /^warning:/.test(stage)) {
        const key = job.clips[Number(stage.split(':')[1])];
        if (key === 'taws-whoop') return window.GANavigationWarningAudio.whoopWav();
        try { bytes = await api.audioRequest('asset', { asset: window.GANavigationWarningAudio.assetPath(key, pack) }); }
        catch (error) { if (key !== 'aw-zwo') throw error; bytes = await api.audioRequest('asset', { asset: window.GANavigationWarningAudio.assetPath('aw-d2', pack) }); }
      } else bytes = await api.audioRequest(stage, { effectId: job.effectId });
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
    onPlayback: job => { if (job) lastError = ''; playbackText = job ? job.text || 'Audioeffekt wird abgespielt.' : ''; render(); },
    onError: error => { lastError = error; $('audioPlaybackStatus').textContent = error; }
  });
  function render() {
    if (!audio) return;
    $('audioTargetSelect').value = audio.target.mode === 'pc' ? 'pc' : 'other';
    if (document.activeElement !== $('audioMasterVolume')) $('audioMasterVolume').value = Math.round(audio.settings.volume * 100);
    $('audioMasterEnabled').checked = audio.settings.enabled;
    $('audioPaxEnabled').checked = audio.settings.paxEnabled;
    $('audioEffectsEnabled').checked = audio.settings.effectsEnabled;
    $('navigationAudioSettings').hidden = !audio.warnings;
    for (const [id, key] of [['audioReadFreq','readFreq'],['audioTerrain','terrain'],['audioAirspace','airspace'],['audioWaypoint','waypoint']]) $(id).checked = audio.settings[key];
    $('audioPaxStyle').value = audio.settings.audioStyle || 'intercom_noise';
    $('audioWarningVoice').value = audio.settings.voicePack || '';
    $('audioPlaybackStatus').textContent = lastError || playbackText || 'Ausgabe: ' + audio.target.name + (audio.cloudState === 'pending' ? ' · Cloud-Speicherung ausstehend' : '');
  }
  function update(patch) {
    lastError = '';
    saving = saving.catch(() => {}).then(async () => {
      if (!audio) return;
      const result = await api.audioRequest('playback', { action: 'settings_update', clientId, expectedRevision: audio.revision, ...patch });
      if (result.audio) { audio = { ...result.audio, playback: audio.playback, warnings: audio.warnings }; player.update(audio); render(); }
      if (!result.ok) throw new Error('Audioeinstellung wurde auf einem anderen Gerät geändert. Bitte erneut wählen.');
    }).catch(error => { $('audioPlaybackStatus').textContent = error.message; });
  }
  $('audioTargetSelect').onchange = () => update({ target: { mode: 'pc' } });
  $('audioMasterVolume').onchange = () => update({ settings: { volume: Number($('audioMasterVolume').value) / 100 } });
  for (const [id, key] of [['audioMasterEnabled','enabled'],['audioPaxEnabled','paxEnabled'],['audioEffectsEnabled','effectsEnabled'],['audioReadFreq','readFreq'],['audioTerrain','terrain'],['audioAirspace','airspace'],['audioWaypoint','waypoint']]) {
    $(id).onchange = () => update({ settings: { [key]: $(id).checked } });
  }
  $('audioPaxStyle').onchange = () => update({ settings: { audioStyle: $('audioPaxStyle').value } });
  $('audioWarningVoice').onchange = () => update({ settings: { voicePack: $('audioWarningVoice').value } });
  fetch('./warning-voices.json').then(response => response.json()).then(catalog => {
    for (const pack of catalog.packs || []) if (/^[a-z0-9-]+$/.test(pack.id)) $('audioWarningVoice').add(new Option(pack.label, pack.id));
    render();
  }).catch(() => {});
  async function devices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const select = $('audioHardwareSelect');
    select.replaceChildren(new Option('Windows-Standardgerät', ''));
    devices.filter(device => device.kind === 'audiooutput' && device.deviceId !== 'default').forEach((device, index) => select.add(new Option(device.label || 'Audioausgang ' + (index + 1), device.deviceId)));
    if (outputId && !Array.from(select.options).some(option => option.value === outputId)) {
      outputId = ''; await player.setOutputDevice(''); await api.setAudioOutputDeviceId('');
      $('audioPlaybackStatus').textContent = 'Der bisherige Audioausgang fehlt. Windows-Standardgerät wird verwendet.';
    }
    select.value = outputId;
  }
  $('audioRefreshDevices').onclick = async () => {
    try {
      if (navigator.mediaDevices.selectAudioOutput) {
        const selected = await navigator.mediaDevices.selectAudioOutput();
        await player.setOutputDevice(selected.deviceId); outputId = selected.deviceId; await api.setAudioOutputDeviceId(outputId);
      }
      await devices();
    } catch (error) { lastError = error.message; render(); }
  };
  $('audioHardwareSelect').onchange = async () => {
    const selected = $('audioHardwareSelect').value;
    try { await player.setOutputDevice(selected); outputId = selected; await api.setAudioOutputDeviceId(selected); }
    catch (error) { $('audioHardwareSelect').value = outputId; $('audioPlaybackStatus').textContent = error.message; }
  };
  navigator.mediaDevices.addEventListener('devicechange', () => devices().catch(() => {}));
  async function tick() {
    if (stopped) return;
    try { audio = (await api.audioRequest('settings')).audio; player.update(audio); render(); }
    catch (error) { audio = null; player.update(null); $('audioPlaybackStatus').textContent = error.message; }
    if (!stopped) setTimeout(tick, 1000);
  }
  api.getState().then(state => { outputId = state.settings.audioOutputDeviceId || ''; return devices(); }).catch(() => {});
  window.addEventListener('pagehide', () => { stopped = true; player.stop(); });
  tick();
})();
