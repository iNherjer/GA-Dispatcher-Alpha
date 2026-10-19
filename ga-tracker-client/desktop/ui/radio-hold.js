(function () {
  'use strict';
  const api = window.trackerDesktop;
  const $ = id => document.getElementById(id);
  if (!api || !api.setRadioHold || !$('radioHoldEnabled')) return;
  let settings = null, hold = null, learning = false, message = '', countdown = null;

  function statusText() {
    if (message) return message;
    if (learning) return 'Jetzt den Funk-Button am Joystick oder eine Taste drücken …';
    if (!settings || !settings.enabled) return 'Funk-Pause ist aus.';
    if (!settings.bindings.length) return 'Bitte zuerst einen Button hinzufügen.';
    if (hold && hold.input && hold.input.supported === false) return 'Button-Erkennung benötigt Windows.';
    if (hold && hold.input && hold.input.connected === false) return 'Joystick nicht gefunden. Er wird automatisch erneut gesucht.';
    if (hold && hold.pressed) return 'Funk aktiv – Audio angehalten.';
    if (hold && hold.held) {
      if (!hold.resumeAt) return 'Angehalten. Fortsetzen per kurzem Druck oder Button unten.';
      return 'Angehalten – geht in ' + Math.max(0, Math.ceil((hold.resumeAt - Date.now()) / 1000)) + ' s weiter.';
    }
    return 'Bereit: ' + settings.bindings.length + (settings.bindings.length === 1 ? ' Eingabe' : ' Eingaben') + ' aktiv.';
  }
  function render() {
    if (settings) {
      $('radioHoldEnabled').checked = settings.enabled;
      const list = $('radioHoldBindings');
      list.replaceChildren();
      settings.bindings.forEach((binding, index) => {
        const item = document.createElement('li'), label = document.createElement('span'), remove = document.createElement('button');
        label.textContent = binding.label;
        remove.type = 'button'; remove.className = 'secondary-button'; remove.textContent = '✕';
        remove.setAttribute('aria-label', binding.label + ' entfernen'); remove.disabled = learning;
        remove.onclick = async () => {
          message = '';
          try { const result = await api.removeRadioHoldButton(index); if (result && result.settings) settings = result.settings; }
          catch (error) { message = error.message; }
          render();
        };
        item.append(label, remove); list.append(item);
      });
      if (!settings.bindings.length) { const empty = document.createElement('li'); empty.className = 'empty'; empty.textContent = 'Noch keine Eingabe belegt.'; list.append(empty); }
      $('radioHoldResume').value = String(settings.resumeSeconds);
      $('radioHoldShortPress').checked = settings.shortPressResumes;
      $('radioHoldVoiceMode').value = settings.voiceMode;
      $('radioHoldVoiceDim').value = String(settings.voiceDimPercent);
      $('radioHoldMusicMode').value = settings.musicMode;
      $('radioHoldMusicDim').value = String(settings.musicDimPercent);
      const voiceDim = settings.voiceMode === 'dim', musicDim = settings.musicMode === 'dim';
      $('radioHoldVoiceDim').hidden = $('radioHoldVoiceDimLabel').hidden = !voiceDim;
      $('radioHoldMusicDim').hidden = $('radioHoldMusicDimLabel').hidden = !musicDim;
    }
    $('radioHoldLearn').disabled = learning || (settings && settings.bindings.length >= 8);
    $('radioHoldLearn').textContent = learning ? 'Warte auf Button …' : '+ Button hinzufügen';
    $('radioHoldResumeNow').disabled = !(hold && hold.held);
    $('radioHoldStatus').textContent = statusText();
    clearTimeout(countdown);
    if (hold && hold.held && hold.resumeAt && !hold.pressed) countdown = setTimeout(render, 500);
  }
  async function save(patch) {
    message = '';
    try { const result = await api.setRadioHold(patch); if (result && result.settings) settings = result.settings; }
    catch (error) { message = error.message; }
    render();
  }
  $('radioHoldEnabled').onchange = () => save({ enabled: $('radioHoldEnabled').checked });
  $('radioHoldResume').onchange = () => save({ resumeSeconds: Number($('radioHoldResume').value) });
  $('radioHoldShortPress').onchange = () => save({ shortPressResumes: $('radioHoldShortPress').checked });
  $('radioHoldVoiceMode').onchange = () => save({ voiceMode: $('radioHoldVoiceMode').value });
  $('radioHoldVoiceDim').onchange = () => save({ voiceDimPercent: Number($('radioHoldVoiceDim').value) });
  $('radioHoldMusicMode').onchange = () => save({ musicMode: $('radioHoldMusicMode').value });
  $('radioHoldMusicDim').onchange = () => save({ musicDimPercent: Number($('radioHoldMusicDim').value) });
  $('radioHoldResumeNow').onclick = () => api.resumeRadioHold().catch(() => {});
  $('radioHoldLearn').onclick = async () => {
    learning = true; message = ''; render();
    try {
      const result = await api.learnRadioHoldButton();
      if (result && result.settings) settings = result.settings;
      if (result && result.ok) {
        const added = message = (result.added ? result.added.label : 'Eingabe') + ' hinzugefügt.';
        setTimeout(() => { if (message === added) { message = ''; render(); } }, 3000);
      }
      else message = (result && result.error) || 'Kein Button erkannt.';
    } catch (error) { message = error.message; }
    learning = false; render();
  };
  api.onRadioHoldChanged(state => { hold = state; render(); });
  api.getState().then(state => { settings = state.settings.radioHold || null; render(); }).catch(() => {});
  if (api.onStateChanged) api.onStateChanged(state => { if (state && state.settings && state.settings.radioHold) { settings = state.settings.radioHold; render(); } });
  api.getRadioHold().then(state => { hold = state; render(); }).catch(() => {});
})();
