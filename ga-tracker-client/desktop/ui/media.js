(function () {
  'use strict';
  const api = window.trackerDesktop;
  const request = payload => typeof api?.mediaRequest === 'function' ? api.mediaRequest(payload)
    : Promise.resolve({ ok: false, error: 'Mediensteuerung benötigt die aktualisierte Windows-Tracker-App.' });
  const $ = id => document.getElementById(id);
  const audible = new Set();
  let stopped = false, busy = false, state = null, available = false;
  // Ducking preferences live in the app (shared with web and EFB); this view only displays and requests changes.
  // One-time migration of the former per-window preference (up to 1.6.24).
  let legacy = null;
  try {
    const saved = JSON.parse(localStorage.getItem('ga.media.preferences.v1') || 'null');
    if (saved && [0.1, 0.2, 0.35, 0.5].includes(saved.duckFactor)) legacy = { enabled: saved.duckEnabled !== false, factor: saved.duckFactor };
  } catch (_) {}
  function render(result) {
    if (!result.ok) {
      available = false;
      $('mediaStatus').textContent = result.error || 'Mediensteuerung nicht verfügbar.';
      $('mediaPlayer').disabled = true;
      return;
    }
    available = true; state = result;
    if (typeof result.duckEnabled === 'boolean' && document.activeElement !== $('mediaDuckEnabled')) $('mediaDuckEnabled').checked = result.duckEnabled;
    if ([0.1, 0.2, 0.35, 0.5].includes(result.duckFactor) && document.activeElement !== $('mediaDuckFactor')) $('mediaDuckFactor').value = String(result.duckFactor);
    const select = $('mediaPlayer');
    const players = result.players || [];
    const existing = Array.from(select.options).map(option => option.value).join('\n');
    const next = players.map(player => player.source).join('\n');
    if (existing !== next) {
      select.replaceChildren();
      if (!players.length) select.add(new Option('Kein Player geöffnet', ''));
      for (const player of players) select.add(new Option(player.name, player.source));
    }
    select.value = result.source || ''; select.disabled = busy || !players.length;
    $('mediaStatus').textContent = !players.length ? 'Player öffnen und dort einen Titel starten.'
      : result.ducking ? 'Musik für Ansage abgesenkt.' : !result.volumeAvailable ? 'Player verbunden; Windows-Audiositzung fehlt für die Absenkung.' : 'Windows-Player verbunden.';
  }
  async function command(payload) {
    if (busy) return;
    busy = true; if (state) render(state);
    try {
      const result = await request(payload);
      busy = false; render(result);
    } catch (_) { busy = false; render({ ok: false, error: 'Windows-Mediensteuerung nicht erreichbar.' }); }
  }
  $('mediaPlayer').onchange = () => command({ action: 'select', source: $('mediaPlayer').value });
  async function settings() {
    const enabled = $('mediaDuckEnabled').checked, factor = Number($('mediaDuckFactor').value);
    // Show the choice at once so a redraw during the request cannot bring back the old value.
    if (state) state = { ...state, duckEnabled: enabled, duckFactor: factor };
    await command({ action: 'settings', enabled, factor });
  }
  $('mediaDuckEnabled').onchange = settings;
  $('mediaDuckFactor').onchange = settings;
  window.GAMediaAudioActivity = (active, job, stage) => {
    const key = String(job?.effectId || '') + ':' + stage;
    if (active) audible.add(key); else audible.delete(key);
    if (available) request({ action: 'duck', active: audible.size > 0 }).catch(() => {});
  };
  async function tick() {
    if (stopped) return;
    try {
      if (!busy) {
        const result = await request({ action: 'snapshot' });
        if (!stopped && !busy) render(result);
        if (legacy && result.ok) {
          const migrate = legacy; legacy = null;
          try { localStorage.removeItem('ga.media.preferences.v1'); } catch (_) {}
          if (result.duckEnabled !== migrate.enabled || result.duckFactor !== migrate.factor) await request({ action: 'settings', ...migrate });
        }
      }
      if (available && audible.size) await request({ action: 'duck', active: true });
    } catch (_) { render({ ok: false, error: 'Windows-Mediensteuerung nicht erreichbar.' }); }
    if (!stopped) setTimeout(tick, 1000);
  }
  window.addEventListener('pagehide', () => {
    stopped = true; audible.clear();
    request({ action: 'duck', active: false }).catch(() => {});
  });
  tick();
})();
