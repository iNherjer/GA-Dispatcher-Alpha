// Generated from media-player-watch-face.js by sync-efb-web-assets.js. Do not edit.
/* Analog Watch face. SVG-only rendering for Coherent; SunCalc v1.9.0 (BSD-2-Clause). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;else root.GAMediaWatchFace = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DAY = 86400000,
    NS = 'http://www.w3.org/2000/svg';
  function finite(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }
  function wrap(v, n) {
    return (v % n + n) % n;
  }
  function hm(s) {
    if (!finite(s)) return '—';
    var m = Math.floor(wrap(s, 86400) / 60);
    return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2);
  }
  function solar(context, engine) {
    var f = context && context.flight;
    if (!f || !finite(f.lat) || !finite(f.lon) || Math.abs(f.lat) > 90 || Math.abs(f.lon) > 180 || !finite(context.instantMs) || !engine) return null;
    var date = new Date(context.instantMs),
      times = engine.getTimes(date, f.lat, f.lon),
      rise = +times.sunrise,
      set = +times.sunset;
    if (!finite(rise) || !finite(set)) return {
      polar: engine.getPosition(date, f.lat, f.lon).altitude > 0 ? 'day' : 'night'
    };
    return {
      rise: wrap(rise / 1000 + context.offsetSeconds, 86400),
      set: wrap(set / 1000 + context.offsetSeconds, 86400)
    };
  }
  function point(seconds, r) {
    var a = seconds / 86400 * Math.PI * 2 - Math.PI / 2;
    return {
      x: 120 + Math.cos(a) * r,
      y: 120 + Math.sin(a) * r
    };
  }
  function arc(start, end) {
    var span = wrap(end - start, 86400),
      a = point(start, 101),
      b = point(end, 101);
    return 'M' + a.x + ',' + a.y + ' A101,101 0 ' + (span > 43200 ? 1 : 0) + ' 1 ' + b.x + ',' + b.y;
  }
  function duration(ms, tenths) {
    var seconds = Math.max(0, ms) / 1000,
      m = Math.floor(seconds / 60),
      s = Math.floor(seconds % 60);
    return ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2) + (tenths ? '.' + Math.floor(seconds * 10 % 10) : '');
  }
  function create(screen, options) {
    var root = window,
      visible = false,
      tools = false,
      mode = 'stopwatch',
      destroyed = false,
      lastSolar = '',
      weather = null,
      weatherAt = 0,
      weatherPos = null,
      requestedAt = 0,
      requestedPos = null,
      pending = false,
      active = false,
      frame = 0;
    var panel = document.createElement('div');
    panel.className = 'ga-watch-face';
    panel.hidden = true;
    function button(action, label, content, cls) {
      return '<button type="button" class="ga-watch-button ga-skin-control ' + (cls || '') + '" data-watch="' + action + '" aria-label="' + label + '">' + content + '</button>';
    }
    var timerIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14" r="8"/><path d="M9 2h6M12 2v4M12 9v5l3 2M18 6l2-2"/></svg>';
    panel.innerHTML = button('timing', 'Stoppuhr und Timer', timerIcon, 'ga-watch-time-tool') + '<div class="ga-watch-temperature" role="img" title="Lokale Bodentemperatur aus dem Wetter"><strong>—</strong><small>°C</small></div><svg class="ga-watch-dial" viewBox="0 0 240 240" role="img" aria-label="Analoge Ortszeit"><circle cx="120" cy="120" r="101" class="ga-watch-night"/><path class="ga-watch-day"/><g class="ga-watch-marks"></g><line class="ga-watch-hour" x1="120" y1="126" x2="120" y2="73"/><line class="ga-watch-minute" x1="120" y1="133" x2="120" y2="47"/><line class="ga-watch-second" x1="120" y1="135" x2="120" y2="39"/><circle cx="120" cy="120" r="4" fill="#ddd"/></svg><div class="ga-watch-sun-label">SR — · SS —</div><div class="ga-watch-qnh" role="img" title="Lokaler Luftdruck auf Meereshöhe aus dem Wetter"><strong>—</strong><small>hPa</small></div>' + button('music', 'Zur Musiksteuerung', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></svg>', 'ga-watch-music-return') + '<div class="ga-watch-face-actions">' + button('more', 'Gerätegröße einstellen', '···') + button('close', 'Mediensteuerung schließen', '×') + '</div><div class="ga-watch-timing" hidden></div>';
    screen.appendChild(panel);
    var marks = panel.querySelector('.ga-watch-marks');
    function svg(tag, attrs, text) {
      var node = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
      if (text) node.textContent = text;
      marks.appendChild(node);
    }
    for (var n = 0; n < 60; n++) {
      var a = n * Math.PI / 30,
        x = Math.sin(a),
        y = -Math.cos(a);
      svg('line', {
        x1: 120 + x * (n % 5 ? 87 : 84),
        y1: 120 + y * (n % 5 ? 87 : 84),
        x2: 120 + x * 90,
        y2: 120 + y * 90,
        stroke: '#ddd',
        'stroke-width': n % 5 ? 1 : 2
      });
    }
    for (var hour = 1; hour <= 12; hour++) {
      var angle = hour * Math.PI / 6;
      svg('text', {
        x: 120 + Math.sin(angle) * 69,
        y: 128 - Math.cos(angle) * 69,
        'text-anchor': 'middle',
        fill: '#f5f5f5',
        'font-size': 23,
        'font-family': 'Arial,sans-serif'
      }, String(hour));
    }
    var timing = panel.querySelector('.ga-watch-timing');
    timing.innerHTML = '<div class="ga-watch-time-tabs">' + button('clock-stopwatch', 'Stoppuhr', 'Stoppuhr') + button('clock-timer', 'Timer', 'Timer') + '</div><output class="ga-watch-elapsed">00:00.0</output><div class="ga-watch-duration">' + button('clock-less', 'Timer eine Minute kürzer', '−') + '<span>Minuten<small>Krone: Sekunden</small></span>' + button('clock-more', 'Timer eine Minute länger', '+') + '</div><div class="ga-watch-time-controls">' + button('clock-toggle', 'Zeitmessung starten oder stoppen', 'Start') + button('clock-reset', 'Zeitmessung zurücksetzen', 'Reset') + '</div>' + button('clock-back', 'Zur Uhr', 'Zur Uhr');
    function context() {
      if (options.getEnvironment) return options.getEnvironment();
      if (root.GADisplayClock && root.GADisplayClock.context) return root.GADisplayClock.context();
      var date = new Date();
      return {
        time: {
          seconds: date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
        },
        instantMs: +date,
        offsetSeconds: -date.getTimezoneOffset() * 60,
        flight: null
      };
    }
    function weatherFresh(f) {
      return weather && weatherPos && Math.abs(f.lat - weatherPos.lat) < .2 && Math.abs(f.lon - weatherPos.lon) < .2 && Date.now() - weatherAt < 900000;
    }
    function refreshWeather(f) {
      if (!f || !finite(f.lat) || !finite(f.lon)) {
        weather = null;
        return;
      }
      if (options.getWeather) {
        weather = options.getWeather(f);
        weatherAt = Date.now();
        weatherPos = f;
        return;
      }
      if (pending || Date.now() - requestedAt < 60000 || typeof root.vpFetchOpenMeteoPoint !== 'function') return;
      if (weatherFresh(f) && Date.now() - weatherAt < 300000) return;
      requestedAt = Date.now();
      requestedPos = {
        lat: f.lat,
        lon: f.lon
      };
      pending = true;
      Promise.resolve(root.vpFetchOpenMeteoPoint(f.lat, f.lon)).then(function (value) {
        if (destroyed) return;
        weather = value;
        weatherAt = Date.now();
        weatherPos = requestedPos;
      }, function () {/* Keep only still-fresh, nearby weather. */}).then(function () {
        pending = false;
      });
    }
    function weatherValue(selector, value, unit) {
      var node = panel.querySelector(selector);
      node.querySelector('strong').textContent = value;
      node.setAttribute('aria-label', (selector === '.ga-watch-qnh' ? 'QNH ' : 'Temperatur ') + value + ' ' + unit);
    }
    function timingSnapshot() {
      return root.GAUtilityTime && root.GAUtilityTime.snapshot();
    }
    function timingText(snapshot) {
      return !snapshot ? '—' : mode === 'stopwatch' ? duration(snapshot.elapsedMs, true) : snapshot.alarm ? 'Fertig' : duration(snapshot.remainingMs, false);
    }
    function paintTime(snapshot) {
      var node = timing.querySelector('.ga-watch-elapsed'),
        text = timingText(snapshot);
      if (node.textContent !== text) node.textContent = text;
    }
    function animating() {
      return !destroyed && active && visible && tools && !document.hidden && panel.getClientRects().length > 0 && root.getComputedStyle(panel).visibility !== 'hidden';
    }
    function cancelFrame() {
      if (frame) {
        root.cancelAnimationFrame(frame);
        frame = 0;
      }
    }
    function animate() {
      frame = 0;
      if (!animating()) return;
      var snapshot = timingSnapshot();
      paintTime(snapshot);
      if (snapshot && (mode === 'stopwatch' ? snapshot.running : snapshot.timerRunning)) frame = root.requestAnimationFrame(animate);
    }
    function syncFrame() {
      var snapshot = animating() && timingSnapshot();
      if (snapshot && (mode === 'stopwatch' ? snapshot.running : snapshot.timerRunning)) {
        if (!frame) frame = root.requestAnimationFrame(animate);
      } else cancelFrame();
    }
    document.addEventListener('visibilitychange', syncFrame);
    function update() {
      panel.classList.toggle('is-timing', tools);
      if (destroyed || !visible || document.hidden) return;
      var c = context(),
        s = c.time && c.time.seconds;
      if (finite(s)) {
        panel.querySelector('.ga-watch-hour').setAttribute('transform', 'rotate(' + wrap(s / 120, 360) + ' 120 120)');
        panel.querySelector('.ga-watch-minute').setAttribute('transform', 'rotate(' + wrap(s / 10, 360) + ' 120 120)');
        panel.querySelector('.ga-watch-second').setAttribute('transform', 'rotate(' + wrap(s * 6, 360) + ' 120 120)');
        panel.querySelector('.ga-watch-dial').setAttribute('aria-label', 'Ortszeit ' + hm(s));
      }
      var f = c.flight,
        solarKey = JSON.stringify([Math.floor((c.instantMs + c.offsetSeconds * 1000) / DAY), c.offsetSeconds, f && Math.round(f.lat * 100) / 100, f && Math.round(f.lon * 100) / 100]);
      if (solarKey !== lastSolar) {
        lastSolar = solarKey;
        var sun = solar(c, root.SunCalc),
          day = panel.querySelector('.ga-watch-day'),
          night = panel.querySelector('.ga-watch-night');
        day.setAttribute('d', sun && finite(sun.rise) ? arc(sun.rise, sun.set) : '');
        night.style.stroke = sun ? sun.polar === 'day' ? '#d94251' : '#235a70' : '#444';
        panel.querySelector('.ga-watch-sun-label').textContent = !sun ? 'SR — · SS —' : sun.polar ? sun.polar === 'day' ? 'Polartag' : 'Polarnacht' : 'SR ' + hm(sun.rise) + ' · SS ' + hm(sun.set);
      }
      refreshWeather(f);
      var localWeather = f && weatherFresh(f) ? weather : null;
      weatherValue('.ga-watch-temperature', localWeather && finite(localWeather.temp2mC) ? String(Math.round(localWeather.temp2mC)) : '—', '°C');
      weatherValue('.ga-watch-qnh', localWeather && finite(localWeather.mslPressureHpa) ? String(Math.round(localWeather.mslPressureHpa)) : '—', 'hPa');
      if (tools) {
        var service = root.GAUtilityTime,
          snapshot = service && service.snapshot();
        paintTime(snapshot);
        timing.querySelector('.ga-watch-duration').hidden = mode !== 'timer';
        timing.querySelector('.ga-watch-duration small').textContent = snapshot && snapshot.timerRunning ? 'Zum Einstellen pausieren' : 'Krone: Sekunden';
        timing.querySelector('[data-watch="clock-toggle"]').textContent = snapshot && (mode === 'stopwatch' ? snapshot.running : snapshot.timerRunning) ? 'Pause' : snapshot && snapshot.alarm && mode === 'timer' ? 'OK' : 'Start';
        timing.querySelector('[data-watch="clock-stopwatch"]').setAttribute('aria-pressed', String(mode === 'stopwatch'));
        timing.querySelector('[data-watch="clock-timer"]').setAttribute('aria-pressed', String(mode === 'timer'));
        timing.querySelectorAll('button').forEach(function (b) {
          b.disabled = !service && b.dataset.watch !== 'clock-back';
        });
      }
      syncFrame();
    }
    function show(value) {
      visible = value;
      panel.hidden = !value;
      screen.classList.toggle('ga-watch-show-face', value);
      if (value) update();else syncFrame();
    }
    function action(value) {
      var service = root.GAUtilityTime;
      if (value === 'music') {
        tools = false;
        timing.hidden = true;
        show(false);
        return true;
      }
      if (value === 'timing') {
        tools = true;
        timing.hidden = false;
        update();
        return true;
      }
      if (value.indexOf('clock-') !== 0) return false;
      if (value === 'clock-back') {
        tools = false;
        timing.hidden = true;
      } else if (value === 'clock-stopwatch') mode = 'stopwatch';else if (value === 'clock-timer') mode = 'timer';else if (service) {
        var state = service.snapshot();
        if (value === 'clock-toggle') service[mode === 'stopwatch' ? 'toggleStopwatch' : 'toggleTimer']();
        if (value === 'clock-reset') service[mode === 'stopwatch' ? 'resetStopwatch' : 'resetTimer']();
        if (value === 'clock-less' || value === 'clock-more') service.setDuration(Math.max(1000, state.durationMs + (value === 'clock-more' ? 60000 : -60000)));
      }
      update();
      return true;
    }
    function crownState() {
      if (!visible || !tools) return null;
      var service = root.GAUtilityTime,
        s = service && service.snapshot();
      return {
        kind: mode === 'timer' ? 'timer' : 'blocked',
        value: s ? Math.round(s.durationMs / 1000) : 1,
        min: 1,
        max: 5999,
        enabled: !!s && mode === 'timer' && !s.timerRunning && !s.alarm
      };
    }
    function setSeconds(value) {
      var c = crownState();
      if (c && c.enabled) {
        root.GAUtilityTime.setDuration(Math.max(c.min, Math.min(c.max, Math.round(value))) * 1000);
        update();
      }
    }
    return {
      show: show,
      setActive: function setActive(value) {
        active = !!value;
        syncFrame();
      },
      update: update,
      action: action,
      crownState: crownState,
      setSeconds: setSeconds,
      isVisible: function isVisible() {
        return visible;
      },
      destroy: function destroy() {
        destroyed = true;
        cancelFrame();
        document.removeEventListener('visibilitychange', syncFrame);
        panel.remove();
      }
    };
  }
  return {
    create: create,
    solar: solar,
    arc: arc
  };
});
