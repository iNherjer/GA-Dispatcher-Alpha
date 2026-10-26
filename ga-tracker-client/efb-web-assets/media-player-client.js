// Generated from media-player-client.js by sync-efb-web-assets.js. Do not edit.
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
(function (root) {
  'use strict';

  function install() {
    var host = document.getElementById('mapTableOverlay'),
      menu = document.getElementById('mapVoiceMenu');
    if (!host || !menu || !root.GAMediaPlayerUI) return;
    var container = document.createElement('div');
    container.className = 'ga-media-settings';
    container.innerHTML = '<label><input type="checkbox" class="ga-media-enable"> Mediensteuerung</label><label>Skin <select class="ga-media-skin" aria-label="Medien-Skin"><option value="winamp">Winamp</option><option value="ipod">iPod</option><option value="watch">Watch</option></select></label><label class="ga-media-player-choice" hidden>Musik-App <select class="ga-media-select" aria-label="Windows-Medienplayer"><option value="">Keine Musik-App aktiv</option></select></label><label><input type="checkbox" class="ga-media-duck" checked> Bei Ansagen leiser</label><label>Restlautstärke <select class="ga-media-factor"><option value="0.1">10 %</option><option value="0.2">20 %</option><option value="0.35">35 %</option><option value="0.5">50 %</option></select></label><div class="ga-media-message" role="status"></div>';
    menu.insertBefore(container, menu.firstChild);
    var check = container.querySelector('.ga-media-enable'),
      select = container.querySelector('.ga-media-select'),
      duck = container.querySelector('.ga-media-duck'),
      factor = container.querySelector('.ga-media-factor'),
      message = container.querySelector('.ga-media-message');
    var enabled = false,
      open = false,
      watching = false,
      epoch = 0,
      state = null,
      revision = -1,
      lastReceived = 0,
      lastReachable = 0,
      pendingAction = false,
      pendingVolume = null,
      pendingSeek = null,
      skin = 'winamp',
      audible = new Set(),
      closed = false,
      nextWatchAt = 0,
      watchTimer = null;
    try {
      var saved = JSON.parse(localStorage.getItem('ga.media.web.v1') || '{}');
      enabled = saved.enabled === true;
      skin = ['ipod', 'watch'].indexOf(saved.skin) >= 0 ? saved.skin : 'winamp';
    } catch (_) {}
    check.checked = enabled;
    container.querySelector('.ga-media-skin').value = skin;
    var errors = {
      tracker_not_connected: 'Tracker nicht verbunden.',
      media_desktop_unavailable: 'Mediensteuerung benötigt die vorbereitete Windows-Tracker-App und Runtime.',
      authority_timeout: 'Keine Tracker-Bestätigung.',
      media_rate_limited: 'Mediensteuerung kurz ausgelastet.'
    };
    function hasMediaControl() {
      return typeof root.gaMediaControlAvailable === 'function' ? root.gaMediaControlAvailable() : (root.liveTrackerCapabilities || []).includes('media.control.v1');
    }
    function send(payload) {
      return typeof root.gaMediaRequest === 'function' ? root.gaMediaRequest(payload) : Promise.resolve({
        ok: false,
        error: 'tracker_not_connected'
      });
    }
    function render() {
      if (!state) return;
      var display = Object.assign({}, state, {
        player: (state.players || []).filter(function (p) {
          return p.source === state.source;
        }).map(function (p) {
          return p.name;
        })[0] || 'WINDOWS',
        connected: state.ok === true
      });
      display.volumeAvailable = state.ok === true && state.volumeAvailable !== false;
      if (state.playing && Number.isFinite(state.positionSeconds)) {
        display.positionSeconds = state.positionSeconds + Math.min(20, Math.max(0, Date.now() - lastReceived) / 1000);
        if (Number.isFinite(state.durationSeconds)) display.positionSeconds = Math.min(state.durationSeconds, display.positionSeconds);
      }
      ui.update(display);
    }
    function receive(result) {
      if (!result.ok) {
        message.textContent = errors[result.error] || result.error || 'Player nicht erreichbar.';
        state = Object.assign({}, state, {
          ok: false
        });
        render();
        return;
      }
      lastReachable = Date.now();
      if (result.changed === false) {
        if (state) {
          if (!state.ok) message.textContent = 'Windows-Player verbunden.';
          state = Object.assign({}, state, {
            ok: true
          });
          render();
        }
        return;
      }
      if (state && result.serverId === state.serverId && Number.isSafeInteger(result.revision) && result.revision < revision) return;
      state = result;
      revision = Number.isSafeInteger(result.revision) ? result.revision : -1;
      lastReceived = Date.now() - Math.min(20000, Math.max(0, Number(result.sampleAgeMs) || 0));
      var players = result.players || [],
        values = players.map(function (p) {
          return p.source;
        }).join('\n');
      if (Array.from(select.options).map(function (p) {
        return p.value;
      }).join('\n') !== values) {
        while (select.firstChild) select.removeChild(select.firstChild);
        if (!players.length) select.add(new Option('Keine Musik-App aktiv', ''));
        players.forEach(function (p) {
          select.add(new Option(p.name, p.source));
        });
      }
      select.value = result.source || '';
      select.disabled = !players.length;
      container.querySelector('.ga-media-player-choice').hidden = players.length < 2;
      duck.checked = result.duckEnabled !== false;
      factor.value = String(result.duckFactor || 0.2);
      if (root.gaEfbRefreshMediaSettings) root.gaEfbRefreshMediaSettings();
      message.textContent = players.length ? result.ducking ? 'Musik für Ansage abgesenkt.' : 'Windows-Player verbunden.' : 'Player am Windows-PC öffnen und einen Titel starten.';
      render();
    }
    function action(_x) {
      return _action.apply(this, arguments);
    }
    function _action() {
      _action = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(payload) {
        var seek, next, _t, _t2;
        return _regenerator().w(function (_context) {
          while (1) switch (_context.p = _context.n) {
            case 0:
              if (!pendingAction) {
                _context.n = 1;
                break;
              }
              if (payload.action === 'volume') pendingVolume = payload;
              if (payload.action === 'seek') pendingSeek = payload;
              return _context.a(2);
            case 1:
              pendingAction = true;
              _context.p = 2;
              _t = receive;
              _context.n = 3;
              return send(payload);
            case 3:
              _t(_context.v);
              _context.n = 5;
              break;
            case 4:
              _context.p = 4;
              _t2 = _context.v;
              receive({
                ok: false,
                error: 'tracker_not_connected'
              });
            case 5:
              _context.p = 5;
              pendingAction = false;
              if (pendingSeek) {
                seek = pendingSeek;
                pendingSeek = null;
                action(seek);
              } else if (pendingVolume) {
                next = pendingVolume;
                pendingVolume = null;
                action(next);
              }
              return _context.f(5);
            case 6:
              return _context.a(2);
          }
        }, _callee, null, [[2, 4, 5, 6]]);
      }));
      return _action.apply(this, arguments);
    }
    var clockEntry = null,
      replacing = false;
    function visible() {
      return !closed && (enabled || !!clockEntry) && open && !document.hidden && root.getComputedStyle(host).visibility !== 'hidden' && host.getBoundingClientRect().width > 0 && host.getBoundingClientRect().height > 0;
    }
    function needsMedia() {
      return visible() && !(ui.isClockView && ui.isClockView());
    }
    function watch() {
      return _watch.apply(this, arguments);
    }
    function _watch() {
      _watch = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
        var current, result, delay, _t3;
        return _regenerator().w(function (_context2) {
          while (1) switch (_context2.p = _context2.n) {
            case 0:
              if (!(watching || !needsMedia() || Date.now() < nextWatchAt)) {
                _context2.n = 1;
                break;
              }
              return _context2.a(2);
            case 1:
              watching = true;
              current = epoch;
              _context2.p = 2;
              _context2.n = 3;
              return send({
                action: 'watch',
                after: revision
              });
            case 3:
              result = _context2.v;
              if (current === epoch && needsMedia()) receive(result);
              _context2.n = 5;
              break;
            case 4:
              _context2.p = 4;
              _t3 = _context2.v;
              if (current === epoch) receive({
                ok: false,
                error: 'tracker_not_connected'
              });
            case 5:
              _context2.p = 5;
              watching = false;
              clearTimeout(watchTimer);
              delay = state && state.ok ? 50 : 5000;
              nextWatchAt = Date.now() + delay;
              if (needsMedia()) watchTimer = setTimeout(watch, delay);
              return _context2.f(5);
            case 6:
              return _context2.a(2);
          }
        }, _callee2, null, [[2, 4, 5, 6]]);
      }));
      return _watch.apply(this, arguments);
    }
    function savePreferences() {
      try {
        localStorage.setItem('ga.media.web.v1', JSON.stringify({
          enabled: enabled,
          skin: skin
        }));
      } catch (_) {}
    }
    // Zoom per skin is kept by the Tracker for this view instance only; a drag alone sends nothing.
    // knownScale is this view's own value: views may share the web storage, so it is the reference.
    var mediaSkins = ['winamp', 'ipod', 'watch'],
      knownScale = {};
    function layoutKey(name) {
      return 'ga.media.' + name + '.layout.v1';
    }
    function readLayout(name) {
      try {
        var v = JSON.parse(localStorage.getItem(layoutKey(name)) || '{}');
        return v && typeof v === 'object' ? v : {};
      } catch (_) {
        return {};
      }
    }
    function writeScale(name, value) {
      var layout = readLayout(name);
      if (layout.scale === value) return;
      layout.scale = value;
      try {
        localStorage.setItem(layoutKey(name), JSON.stringify(layout));
      } catch (_) {}
    }
    function clampScale(value) {
      return Math.round(Math.max(0.5, Math.min(1.6, value)) * 100) / 100;
    }
    function layoutSaved(name, value) {
      if (!Number.isFinite(value)) return;
      value = clampScale(value);
      if (knownScale[name] === value) return;
      knownScale[name] = value;
      if (typeof root.gaPersistMediaScale === 'function') root.gaPersistMediaScale(name, value);
    }
    function applyScale(name, value) {
      if (mediaSkins.indexOf(name) < 0 || !Number.isFinite(value)) return false;
      value = clampScale(value);
      if (knownScale[name] === value) return false;
      knownScale[name] = value;
      writeScale(name, value);
      return true;
    }
    function createSkin(requestedSkin) {
      var viewSkin = requestedSkin || skin;
      if (Object.prototype.hasOwnProperty.call(knownScale, viewSkin)) writeScale(viewSkin, knownScale[viewSkin]);else {
        var savedScale = readLayout(viewSkin).scale;
        knownScale[viewSkin] = Number.isFinite(savedScale) ? clampScale(savedScale) : 1;
      }
      return root.GAMediaPlayerUI.create({
        host: host,
        skin: viewSkin,
        storageKey: layoutKey(viewSkin),
        onLayoutSave: function onLayoutSave(value) {
          layoutSaved(viewSkin, value);
        },
        state: {
          connected: false,
          volumeAvailable: false
        },
        onCommand: action,
        onViewChange: function onViewChange() {
          if (root.GAClockSkins) root.GAClockSkins.refresh();
        },
        onVisibilityChange: function onVisibilityChange(value) {
          open = value;
          epoch++;
          clearTimeout(watchTimer);
          nextWatchAt = 0;
          if (value) watch();
          if (!value && clockEntry && !replacing) {
            var entry = clockEntry;
            setTimeout(function () {
              if (clockEntry === entry) restoreClock();
            }, 0);
          }
          if (root.GAClockSkins) root.GAClockSkins.refresh();
        }
      });
    }
    var ui = createSkin();
    ui.setEnabled(enabled);
    // The simulator web view does not keep localStorage across restarts; the Tracker config is the durable copy.
    function persist(key, value) {
      if (typeof root.gaPersistMediaSetting === 'function') root.gaPersistMediaSetting(key, value);
    }
    function setEnabled(value, save) {
      value = value === true;
      if (value === enabled && save === false) return;
      enabled = value;
      check.checked = enabled;
      savePreferences();
      ui.setEnabled(enabled);
      if (root.gaEfbRefreshMediaSettings) root.gaEfbRefreshMediaSettings();
      if (save !== false) persist('mediaEnabled', enabled);
    }
    check.onchange = function () {
      setEnabled(check.checked);
    };
    function setSkin(value, save, force) {
      var next = ['ipod', 'watch'].indexOf(value) >= 0 ? value : 'winamp';
      if (next === skin && save === false && !force) return;
      var skinSelect = container.querySelector('.ga-media-skin');
      if (skinSelect.value !== next) skinSelect.value = next;
      clockEntry = null;
      replacing = true;
      var reopen = open;
      skin = next;
      savePreferences();
      epoch++;
      clearTimeout(watchTimer);
      ui.destroy();
      open = false;
      ui = createSkin();
      ui.setEnabled(enabled);
      replacing = false;
      if (reopen && enabled) ui.open();
      render();
      if (root.gaMediaPlayerClient) root.gaMediaPlayerClient.ui = ui;
      if (root.gaEfbRefreshMediaSettings) root.gaEfbRefreshMediaSettings();
      if (save !== false) persist('mediaSkin', skin);
    }
    container.querySelector('.ga-media-skin').onchange = function () {
      setSkin(this.value);
    };
    function publishUi() {
      if (root.gaMediaPlayerClient) root.gaMediaPlayerClient.ui = ui;
    }
    function restoreClock() {
      if (!clockEntry) return;
      var resume = clockEntry.reopen;
      clockEntry = null;
      replacing = true;
      epoch++;
      clearTimeout(watchTimer);
      ui.destroy();
      open = false;
      ui = createSkin();
      ui.setEnabled(enabled);
      replacing = false;
      if (resume && enabled) ui.open();
      render();
      publishUi();
      if (root.GAClockSkins) root.GAClockSkins.refresh();
    }
    function openClock() {
      if (clockEntry) {
        ui.openClock();
        return;
      }
      var entry = {
        reopen: open
      };
      replacing = true;
      epoch++;
      clearTimeout(watchTimer);
      ui.destroy();
      open = false;
      clockEntry = entry;
      ui = createSkin('watch');
      ui.setEnabled(true);
      replacing = false;
      publishUi();
      ui.openClock();
      render();
    }
    select.onchange = function () {
      action({
        action: 'select',
        source: select.value
      });
    };
    function settings() {
      action({
        action: 'settings',
        enabled: duck.checked,
        factor: Number(factor.value)
      });
    }
    duck.onchange = settings;
    factor.onchange = settings;
    root.addEventListener('ga:media-audible', function (event) {
      var d = event.detail || {},
        key = String(d.effectId || '') + ':' + d.stage;
      if (d.active) audible.add(key);else audible.delete(key);
      if (hasMediaControl()) send({
        action: 'duck',
        active: audible.size > 0
      }).catch(function () {});
    });
    // With the player closed, the settings panel still shows ducking shared with the app; refresh it while visible.
    var settingsPolledAt = -Infinity;
    function settingsShown() {
      if (closed || document.hidden || !hasMediaControl()) return false;
      var box = typeof container.getBoundingClientRect === 'function' ? container.getBoundingClientRect() : null;
      return !!box && box.width > 0 && box.height > 0;
    }
    var timer = setInterval(function () {
      if (visible()) {
        render();
        watch();
      } else if (!pendingAction && settingsShown() && Date.now() - settingsPolledAt >= 3000) {
        settingsPolledAt = Date.now();
        send({
          action: 'snapshot'
        }).then(function (result) {
          if (!visible() && result && result.ok) receive(result);
        }).catch(function () {});
      }
      // Only active speech renews its short lease; collapsed controls need no status traffic.
      if (audible.size && hasMediaControl()) send({
        action: 'duck',
        active: true
      }).catch(function () {});
      if (state && Date.now() - lastReachable > 45000) {
        state = Object.assign({}, state, {
          ok: false
        });
        render();
      }
    }, 1000);
    root.addEventListener('visibilitychange', function () {
      epoch++;
      if (!document.hidden) watch();
    });
    root.addEventListener('pagehide', function () {
      closed = true;
      clearInterval(timer);
      clearTimeout(watchTimer);
      if (audible.size) send({
        action: 'duck',
        active: false
      }).catch(function () {});
      audible.clear();
    });
    root.gaMediaPlayerClient = {
      receive: receive,
      ui: ui,
      preferences: function preferences() {
        return {
          enabled: enabled,
          skin: skin
        };
      },
      applyPreferences: function applyPreferences(value) {
        if (!value) return;
        if (typeof value.enabled === 'boolean') setEnabled(value.enabled, false);
        if (typeof value.skin === 'string') setSkin(value.skin, false);
        if (value.scales) {
          var rebuild = false;
          mediaSkins.forEach(function (name) {
            if (applyScale(name, value.scales[name]) && name === skin && !clockEntry) rebuild = true;
          });
          if (rebuild) setSkin(skin, false, true);
        }
      },
      openClock: openClock,
      closeClock: function closeClock() {
        if (clockEntry) ui.close();
      },
      isClockOpen: function isClockOpen() {
        return !!clockEntry && open && !!(ui.isClockView && ui.isClockView());
      }
    };
    if (root.gaEfbMediaSettings) root.gaEfbMediaSettings(container);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);else install();
})(window);
