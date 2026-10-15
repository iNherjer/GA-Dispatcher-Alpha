// Generated from media-player-ui.js by sync-efb-web-assets.js. Do not edit.
(function (root) {
  'use strict';

  var symbols = {
    previous: '<path d="M3 4h3v16H3zm17 0v16L7 12z"/>',
    play: '<path d="M6 3v18l15-9z"/>',
    pause: '<path d="M5 3h5v18H5zm9 0h5v18h-5z"/>',
    next: '<path d="M18 4h3v16h-3zM4 4l13 8L4 20z"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + symbols[name] + '</svg>';
  }
  function key(name, label) {
    return '<button class="ga-media-key" type="button" data-command="' + name + '" aria-label="' + label + '" title="' + label + '">' + icon(name) + '</button>';
  }
  function clock(seconds) {
    if (!Number.isFinite(seconds)) return '<text x="15" y="38" fill="currentColor" font-size="32" font-family="monospace">--:--</text>';
    var minutes = Math.floor(Math.max(0, seconds) / 60),
      rest = Math.floor(Math.max(0, seconds)) % 60;
    var value = ('0' + Math.min(minutes, 99)).slice(-2) + ('0' + rest).slice(-2);
    var digits = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgecd', 'abc', 'abcdefg', 'abfgcd'];
    var lines = {
      a: '4,1 22,1',
      b: '24,3 24,21',
      c: '24,25 24,43',
      d: '4,45 22,45',
      e: '2,25 2,43',
      f: '2,3 2,21',
      g: '4,23 22,23'
    };
    return value.split('').map(function (d, i) {
      var x = i * 31 + (i >= 2 ? 12 : 0);
      return '<g transform="translate(' + x + ',0)">' + digits[Number(d)].split('').map(function (s) {
        return '<polyline points="' + lines[s] + '" fill="none" stroke="currentColor" stroke-width="2.5"/>';
      }).join('') + '</g>';
    }).join('') + '<rect x="63" y="13" width="3" height="3"/><rect x="63" y="31" width="3" height="3"/>';
  }
  function create(options) {
    options = options || {};
    if (options.skin === 'ipod') return root.GAMediaIPodUI.create(options);
    var host = options.host || document.body;
    var layer = document.createElement('div');
    layer.className = 'ga-media-layer';
    layer.innerHTML = '<button class="ga-media-launcher" type="button" aria-label="Mediensteuerung öffnen" title="Mediensteuerung öffnen">𝄞</button>' + '<section class="ga-media-device" role="region" aria-label="Winamp Mediensteuerung" hidden>' + '<header class="ga-media-header"><span class="ga-media-bolt" aria-hidden="true">ϟ</span><span class="ga-media-header-line"></span><span class="ga-media-brand">WINAMP</span><span class="ga-media-header-line"></span><button class="ga-media-close" type="button" aria-label="Mediensteuerung schließen">×</button></header>' + '<div class="ga-media-main"><div class="ga-media-display ga-media-clock"><div class="ga-media-clock-top"><svg class="ga-media-state-icon" viewBox="0 0 24 24" aria-hidden="true"></svg><svg class="ga-media-digits" viewBox="0 0 138 48" role="img" aria-label="Abspielzeit"></svg></div><div class="ga-media-signal"><span>PC AUDIO</span><div class="ga-media-leds" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>' + '<div class="ga-media-now"><div class="ga-media-display ga-media-track"><div class="ga-media-marquee"><span class="ga-media-title"></span><span class="ga-media-title ga-media-copy" aria-hidden="true"></span></div></div><div class="ga-media-status-row"><div class="ga-media-app-switcher" role="group" aria-label="Musik-App auswählen"><button class="ga-media-app-key" type="button" data-source-step="-1" aria-label="Vorherige Musik-App" title="Vorherige Musik-App">◀</button><span class="ga-media-source"></span><button class="ga-media-app-key" type="button" data-source-step="1" aria-label="Nächste Musik-App" title="Nächste Musik-App">▶</button></div><span class="ga-media-status"></span></div><div class="ga-media-mixer"><label class="ga-media-label">VOL</label><input class="ga-media-volume" aria-label="Musiklautstärke" type="range" min="0" max="100"><output class="ga-media-volume-text"></output></div></div></div>' + '<div class="ga-media-seek-row" role="progressbar" aria-label="Wiedergabefortschritt"><div class="ga-media-progress"></div><div class="ga-media-position"></div><input class="ga-media-seek" type="range" min="0" max="1000" step="1" aria-label="Wiedergabeposition" disabled></div>' + '<footer class="ga-media-footer"><div class="ga-media-transport">' + key('previous', 'Vorheriger Titel') + key('play', 'Abspielen') + key('pause', 'Pause') + key('next', 'Nächster Titel') + '</div><div class="ga-media-zoom"><span class="ga-media-zoom-label">ZOOM<output>100%</output></span><button class="ga-media-key" type="button" data-zoom="-1" aria-label="Gerät verkleinern">−</button><button class="ga-media-key" type="button" data-zoom="1" aria-label="Gerät vergrößern">+</button></div><span class="ga-media-footer-mark" aria-hidden="true">ϟ</span></footer></section>';
    host.appendChild(layer);
    var device = layer.querySelector('.ga-media-device'),
      launcher = layer.querySelector('.ga-media-launcher');
    var open = false,
      enabled = true,
      x = Number.isFinite(options.x) ? options.x : 30,
      y = Number.isFinite(options.y) ? options.y : 70,
      scale = 1,
      state = {},
      drag = null,
      suppressUntil = 0;
    function save() {
      if (options.storageKey) {
        try {
          localStorage.setItem(options.storageKey, JSON.stringify({
            x: x,
            y: y,
            scale: scale
          }));
        } catch (_) {}
      }
    }
    if (options.storageKey) {
      try {
        var saved = JSON.parse(localStorage.getItem(options.storageKey) || '{}');
        if (Number.isFinite(saved.x)) x = saved.x;
        if (Number.isFinite(saved.y)) y = saved.y;
        if (Number.isFinite(saved.scale)) scale = Math.max(0.5, Math.min(1.6, saved.scale));
      } catch (_) {}
    }
    function layout() {
      var w = layer.clientWidth,
        h = layer.clientHeight;
      if (open) scale = Math.min(scale, Math.max(0.15, Math.min((w - 12) / 640, (h - 12) / 264)));
      var width = open ? 640 * scale : 58,
        height = open ? 264 * scale : 58;
      x = Math.max(6, Math.min(x, Math.max(6, w - width - 6)));
      y = Math.max(6, Math.min(y, Math.max(6, h - height - 6)));
      [device, launcher].forEach(function (el) {
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      });
      device.style.transform = 'scale(' + scale + ')';
      device.hidden = !enabled || !open;
      launcher.hidden = !enabled || open;
      device.querySelector('.ga-media-zoom-label output').textContent = Math.round(scale * 100) + '%';
    }
    function show(value) {
      open = value;
      layout();
      save();
      if (options.onVisibilityChange) options.onVisibilityChange(enabled && open);
    }
    launcher.addEventListener('click', function () {
      if (Date.now() > suppressUntil) show(true);
    });
    device.querySelector('.ga-media-close').addEventListener('click', function () {
      show(false);
      launcher.focus();
    });
    layer.addEventListener('click', function (event) {
      var zoom = event.target.closest('[data-zoom]'),
        command = event.target.closest('[data-command]'),
        sourceStep = event.target.closest('[data-source-step]');
      if (sourceStep && !sourceStep.disabled && options.onCommand) {
        var players = state.players || [],
          index = players.findIndex(function (p) {
            return p.source === state.source;
          });
        var next = index < 0 ? 0 : (index + Number(sourceStep.dataset.sourceStep) + players.length) % players.length;
        if (players[next]) options.onCommand({
          action: 'select',
          source: players[next].source
        });
      }
      if (zoom) {
        scale = Math.max(0.5, Math.min(1.6, scale + Number(zoom.dataset.zoom) * 0.1));
        layout();
        save();
      }
      if (command && !command.disabled && options.onCommand) options.onCommand({
        action: command.dataset.command
      });
    });
    var volume = device.querySelector('.ga-media-volume');
    volume.addEventListener('input', function () {
      device.querySelector('.ga-media-volume-text').textContent = volume.value + '%';
    });
    volume.addEventListener('change', function () {
      if (options.onCommand) options.onCommand({
        action: 'volume',
        volume: Number(volume.value) / 100
      });
    });
    var seekInput = device.querySelector('.ga-media-seek'),
      seekDraft = null,
      seekKey = '';
    function seekAvailable() {
      return state.connected !== false && state.controls && state.controls.seek === true && Number.isFinite(state.positionSeconds) && Number.isFinite(state.durationSeconds) && state.durationSeconds > 0;
    }
    function seekIdentity() {
      return [state.source, state.title, state.artist].join('|');
    }
    seekInput.addEventListener('input', function () {
      if (!seekAvailable()) return;
      seekKey = seekIdentity();
      seekDraft = Number(seekInput.value) / 1000 * state.durationSeconds;
      drawProgress(seekDraft, state.durationSeconds);
    });
    seekInput.addEventListener('change', function () {
      if (seekDraft !== null && seekKey === seekIdentity() && seekAvailable() && options.onCommand) options.onCommand({
        action: 'seek',
        source: state.source,
        positionSeconds: seekDraft
      });
      seekDraft = null;
    });
    seekInput.addEventListener('pointercancel', function () {
      seekDraft = null;
      update(state);
    });
    function drawProgress(positionSeconds, durationSeconds) {
      var known = Number.isFinite(positionSeconds) && Number.isFinite(durationSeconds) && durationSeconds > 0,
        progress = known ? Math.min(100, Math.max(0, positionSeconds / durationSeconds * 100)) : 0;
      device.querySelector('.ga-media-progress').style.width = progress + '%';
      var position = device.querySelector('.ga-media-position');
      position.classList.toggle('is-unknown', !known);
      position.style.left = 'calc(' + progress + '% + ' + (26 - progress * .52) + 'px)';
      var row = device.querySelector('.ga-media-seek-row');
      row.setAttribute('aria-valuemin', '0');
      row.setAttribute('aria-valuemax', '100');
      if (known) row.setAttribute('aria-valuenow', String(Math.round(progress)));else row.removeAttribute('aria-valuenow');
    }
    function start(event) {
      if (event.button !== 0 || event.target.closest('button') !== launcher && event.target.closest('button,input')) return;
      event.preventDefault();
      event.stopPropagation();
      drag = {
        id: event.pointerId,
        px: event.clientX,
        py: event.clientY,
        x: x,
        y: y,
        moved: false
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    function move(event) {
      if (!drag || drag.id !== event.pointerId) return;
      var delta = root.GAEfbUiScale ? root.GAEfbUiScale.delta : function (value) {
        return value;
      };
      var dx = delta(event.clientX - drag.px),
        dy = delta(event.clientY - drag.py);
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      x = drag.x + dx;
      y = drag.y + dy;
      layout();
      event.stopPropagation();
    }
    function end(event) {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.moved) suppressUntil = Date.now() + 250;
      drag = null;
      save();
    }
    [launcher, device.querySelector('.ga-media-header')].forEach(function (el) {
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
    layer.addEventListener('pointerdown', function (event) {
      event.stopPropagation();
    });
    layer.addEventListener('wheel', function (event) {
      event.stopPropagation();
    });
    ['pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mousemove', 'mouseup', 'dblclick'].forEach(function (type) {
      layer.addEventListener(type, function (event) {
        event.stopPropagation();
      }, false);
    });
    ['contextmenu', 'selectstart'].forEach(function (type) {
      layer.addEventListener(type, function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    function update(value) {
      state = value || {};
      var title = [state.artist, state.title].filter(Boolean).join(' — ') || 'Kein Titel';
      device.querySelectorAll('.ga-media-title').forEach(function (el) {
        el.textContent = title;
      });
      var track = device.querySelector('.ga-media-track');
      track.classList.toggle('is-overflow', device.querySelector('.ga-media-title').scrollWidth > track.clientWidth - 18);
      var source = device.querySelector('.ga-media-source');
      source.textContent = state.player || 'WINDOWS';
      source.title = state.player || 'Windows-Musikplayer';
      device.querySelectorAll('[data-source-step]').forEach(function (el) {
        el.disabled = state.connected === false || (state.players || []).length < 2;
      });
      device.querySelector('.ga-media-status').textContent = (state.connected === false ? 'OFFLINE' : state.ducking ? 'ABSENKUNG' : state.playing ? 'PLAYING' : 'PAUSE') + (state.positionKind === 'estimated' ? ' · ZEIT GESCHÄTZT' : '');
      device.querySelector('.ga-media-state-icon').innerHTML = symbols[state.playing ? 'play' : 'pause'];
      var digits = device.querySelector('.ga-media-digits');
      digits.innerHTML = clock(state.positionSeconds);
      digits.setAttribute('aria-label', Number.isFinite(state.positionSeconds) ? Math.floor(state.positionSeconds / 60) + ':' + ('0' + Math.floor(state.positionSeconds % 60)).slice(-2) : 'Abspielzeit nicht verfügbar');
      digits.title = state.positionKind === 'estimated' ? 'Geschätzte Wiedergabezeit seit Beobachtung; keine bestätigte Titelposition.' : 'Vom Windows-Player gemeldete Titelposition';
      if (state.positionKind === 'estimated') digits.setAttribute('aria-label', 'Geschätzte Zeit seit Beobachtung: ' + digits.getAttribute('aria-label'));
      if (document.activeElement !== volume) volume.value = Math.round((Number.isFinite(state.volume) ? state.volume : 0) * 100);
      volume.disabled = state.volumeAvailable === false;
      device.querySelector('.ga-media-volume-text').textContent = state.volumeAvailable === false ? '–' : volume.value + '%';
      device.querySelectorAll('[data-command]').forEach(function (el) {
        var action = el.dataset.command;
        el.disabled = state.connected === false || state.controls && state.controls[action] === false;
      });
      if (seekKey !== seekIdentity() || !seekAvailable()) seekDraft = null;
      seekInput.disabled = !seekAvailable();
      seekInput.title = seekAvailable() ? 'Wiedergabeposition ändern' : 'Spulen für diesen Player nicht verfügbar';
      var positionSeconds = seekDraft === null ? state.positionSeconds : seekDraft;
      drawProgress(positionSeconds, state.durationSeconds);
      if (seekDraft === null) seekInput.value = Number.isFinite(positionSeconds) && state.durationSeconds > 0 ? Math.round(positionSeconds / state.durationSeconds * 1000) : 0;
      seekInput.setAttribute('aria-valuetext', Number.isFinite(positionSeconds) ? Math.floor(positionSeconds / 60) + ':' + ('0' + Math.floor(positionSeconds % 60)).slice(-2) : 'Nicht verfügbar');
    }
    function resize() {
      layout();
      save();
    }
    root.addEventListener('resize', resize);
    layout();
    update(options.state);
    return {
      update: update,
      open: function open() {
        show(true);
        update(state);
      },
      close: function close() {
        show(false);
      },
      setEnabled: function setEnabled(value) {
        enabled = !!value;
        layout();
        if (options.onVisibilityChange) options.onVisibilityChange(enabled && open);
      },
      destroy: function destroy() {
        root.removeEventListener('resize', resize);
        layer.remove();
      },
      element: device,
      launcher: launcher
    };
  }
  root.GAMediaPlayerUI = {
    create: create
  };
})(window);
