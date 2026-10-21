(function () {
  'use strict';
  const api = window.trackerDesktop;
  const $ = id => document.getElementById(id);
  if (!api || !api.setRadioHold || !$('radioHoldEnabled')) return;
  let settings = null, hold = null, learning = false, message = '', countdown = null;
  let programsKey = '', picking = false;
  const levels = new Map();
  // Same thresholds as the main process (lib/radio-hold.js SENSITIVITY), shown as a marker on the meter.
  const THRESHOLDS = { low: 0.1, medium: 0.03, high: 0.01 };
  // Perceptual scale so quiet speech is still visible: 0.001 (-60 dB) .. 1 (0 dB).
  const meterPercent = peak => peak <= 0.001 ? 0 : Math.min(100, Math.max(0, (Math.log10(peak) + 3) / 3 * 100));
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  function meter(name, threshold) {
    const box = element('span', 'radio-hold-meter'); box.dataset.meter = name;
    box.append(element('span'));
    if (threshold) { const mark = element('i'); mark.style.left = meterPercent(threshold) + '%'; box.append(mark); }
    return box;
  }
  function updateMeters() {
    for (const box of document.querySelectorAll('[data-meter]')) box.firstChild.style.width = meterPercent(levels.get(box.dataset.meter) || 0) + '%';
  }
  function saveDetection(patch) {
    const detection = { ...settings.detection, ...patch };
    save({ detection });
  }
  function renderPrograms() {
    const key = JSON.stringify(settings.detection);
    if (key === programsKey) return;
    programsKey = key;
    const list = $('radioHoldPrograms');
    list.replaceChildren();
    settings.detection.programs.forEach((program, index) => {
      const item = element('li'); item.dataset.program = program.name;
      const mode = element('select'), sensitivity = element('select'), remove = element('button', 'secondary-button', '✕');
      mode.append(new Option('Wie PTT', 'ptt'), new Option('Nur leiser', 'dim')); mode.value = program.mode;
      mode.setAttribute('aria-label', program.name + ': Verhalten');
      sensitivity.append(new Option('Empf. niedrig', 'low'), new Option('Empf. mittel', 'medium'), new Option('Empf. hoch', 'high'));
      sensitivity.title = 'Empfindlichkeit: ab welchem Pegel und nach welcher Dauer das Programm erkannt wird';
      sensitivity.value = program.sensitivity; sensitivity.setAttribute('aria-label', program.name + ': Empfindlichkeit');
      const update = patch => saveDetection({ programs: settings.detection.programs.map((entry, position) => position === index ? { ...entry, ...patch } : entry) });
      mode.onchange = () => update({ mode: mode.value });
      sensitivity.onchange = () => update({ sensitivity: sensitivity.value });
      remove.type = 'button'; remove.setAttribute('aria-label', program.name + ' entfernen');
      remove.onclick = () => saveDetection({ programs: settings.detection.programs.filter((_entry, position) => position !== index) });
      item.append(element('span', 'program-name', program.name), remove, mode, sensitivity, meter(program.name, THRESHOLDS[program.sensitivity]));
      list.append(item);
    });
    if (!settings.detection.programs.length) list.append(element('li', 'empty', 'Noch kein Programm eingetragen.'));
    updateMeters();
  }
  function renderPicker() {
    $('radioHoldPicker').hidden = !picking;
    if (!picking) return;
    const list = $('radioHoldPickerList');
    const known = new Set((settings ? settings.detection.programs : []).map(program => program.name.toLowerCase()));
    const names = [...levels.keys()].filter(name => !known.has(name.toLowerCase())).sort((a, b) => (levels.get(b) || 0) - (levels.get(a) || 0) || a.localeCompare(b));
    const rows = new Map([...list.children].filter(item => item.dataset.entry).map(item => [item.dataset.entry, item]));
    for (const [name, item] of rows) if (!names.includes(name)) item.remove();
    list.querySelector('.empty')?.remove();
    for (const name of names) {
      if (rows.has(name)) continue;
      const item = element('li'); item.dataset.entry = name;
      const add = element('button', 'secondary-button', 'Hinzufügen'); add.type = 'button';
      add.onclick = async () => {
        message = '';
        try {
          const result = await api.addRadioHoldProgram(name);
          if (result && result.settings) settings = result.settings;
          message = result && result.ok ? name + ' hinzugefügt.' : (result && result.error) || 'Programm konnte nicht hinzugefügt werden.';
        } catch (error) { message = error.message; }
        render();
      };
      item.append(element('span', 'program-name', name), meter(name, 0), add);
      list.append(item);
    }
    if (!names.length) list.append(element('li', 'empty', 'Gerade gibt kein weiteres Programm Ton aus.'));
    updateMeters();
  }

  function statusText() {
    if (message) return message;
    if (learning) return 'Jetzt den Funk-Button am Joystick oder eine Taste drücken …';
    if (!settings || !settings.enabled) return 'Funk-Pause ist aus.';
    if (!settings.bindings.length && !(settings.detection.enabled && settings.detection.programs.length)) return 'Bitte zuerst einen Button oder ein Programm hinzufügen.';
    if (hold && hold.input && hold.input.supported === false) return 'Button-Erkennung benötigt Windows.';
    if (hold && hold.input && hold.input.connected === false) return 'Joystick nicht gefunden. Er wird automatisch erneut gesucht.';
    if (hold && hold.pressed) return 'Funk aktiv – Audio angehalten.';
    if (hold && hold.held && hold.sources && hold.sources.length) return hold.sources.join(', ') + ' spricht – Audio ' + (hold.voice && hold.voice.mode === 'pause' ? 'angehalten.' : 'leiser.');
    if (hold && hold.held) {
      if (!hold.resumeAt) return 'Angehalten. Fortsetzen per kurzem Druck oder Button unten.';
      return 'Angehalten – geht in ' + Math.max(0, Math.ceil((hold.resumeAt - Date.now()) / 1000)) + ' s weiter.';
    }
    const programs = settings.detection.enabled ? settings.detection.programs.length : 0;
    return 'Bereit: ' + settings.bindings.length + (settings.bindings.length === 1 ? ' Eingabe' : ' Eingaben')
      + (programs ? ', ' + programs + (programs === 1 ? ' Programm' : ' Programme') : '') + ' aktiv.';
  }
  function render() {
    if (settings) {
      if (document.activeElement !== $('radioHoldEnabled')) $('radioHoldEnabled').checked = settings.enabled;
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
      // Never overwrite a control the user is operating; Chromium would report it as a new choice.
      const set = (id, property, value) => { if (document.activeElement !== $(id)) $(id)[property] = value; };
      set('radioHoldResume', 'value', String(settings.resumeSeconds));
      set('radioHoldShortPress', 'checked', settings.shortPressResumes);
      set('radioHoldVoiceMode', 'value', settings.voiceMode);
      set('radioHoldVoiceDim', 'value', String(settings.voiceDimPercent));
      set('radioHoldMusicMode', 'value', settings.musicMode);
      set('radioHoldMusicDim', 'value', String(settings.musicDimPercent));
      set('radioHoldDetectEnabled', 'checked', settings.detection.enabled);
      renderPrograms();
      for (const item of $('radioHoldPrograms').children) item.classList.toggle('active', !!(hold && hold.sources && hold.sources.includes(item.dataset.program)));
      // "Nur leiser" programs use the remaining levels even when the shared rules pause.
      const dimPrograms = settings.detection.enabled && settings.detection.programs.some(program => program.mode === 'dim');
      const voiceDim = settings.voiceMode === 'dim' || dimPrograms, musicDim = settings.musicMode === 'dim' || (dimPrograms && settings.musicMode !== 'none');
      $('radioHoldVoiceDim').hidden = $('radioHoldVoiceDimLabel').hidden = !voiceDim;
      $('radioHoldMusicDim').hidden = $('radioHoldMusicDimLabel').hidden = !musicDim;
    }
    $('radioHoldLearn').disabled = learning || (settings && settings.bindings.length >= 8);
    $('radioHoldLearn').textContent = learning ? 'Warte auf Button …' : '+ Button hinzufügen';
    $('radioHoldResumeNow').disabled = !(hold && hold.held);
    $('radioHoldAddProgram').disabled = picking || (settings && settings.detection.programs.length >= 8);
    renderPicker();
    $('radioHoldStatus').textContent = statusText();
    clearTimeout(countdown);
    if (hold && hold.held && hold.resumeAt && !hold.pressed) countdown = setTimeout(render, 500);
  }
  async function save(patch) {
    message = '';
    // Show the choice at once so state broadcasts during the save cannot redraw the old value.
    if (settings) settings = { ...settings, ...patch };
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
  $('radioHoldDetectEnabled').onchange = () => saveDetection({ enabled: $('radioHoldDetectEnabled').checked });
  // The main process ends the live list after a minute; close the picker with it.
  let pickerTimer = null;
  async function setPicking(value) {
    picking = value;
    clearTimeout(pickerTimer);
    if (value) pickerTimer = setTimeout(() => { if (picking) { picking = false; $('radioHoldPickerList').replaceChildren(); render(); } }, 60000);
    if (!value) $('radioHoldPickerList').replaceChildren();
    try {
      const result = await api.listRadioHoldAudio(value);
      if (value && result && !result.ok) { picking = false; message = result.error; }
    } catch (error) { picking = false; message = error.message; }
    render();
  }
  $('radioHoldAddProgram').onclick = () => { message = ''; setPicking(true); };
  $('radioHoldPickerClose').onclick = () => setPicking(false);
  api.onRadioHoldLevels(sessions => {
    const seen = new Set();
    for (const entry of sessions) { levels.set(entry.name, entry.peak); seen.add(entry.name); }
    for (const name of [...levels.keys()]) if (!seen.has(name)) levels.delete(name);
    updateMeters();
    if (picking) renderPicker();
  });
  window.addEventListener('pagehide', () => { if (picking) api.listRadioHoldAudio(false).catch(() => {}); });
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
