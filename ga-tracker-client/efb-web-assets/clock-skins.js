// Generated from clock-skins.js by sync-efb-web-assets.js. Do not edit.
/* Clock presentation registry. All skins share GAUtilityTime; only views differ. */
(function (root) {
  'use strict';

  var providers = {},
    _selected = 'stopwatch',
    KEY = 'ga.clock.skin.v1',
    choices = null;
  // UI language (i18n-core.js, web only). In the EFB there is no GAI18n: the German text is used.
  function csText(key, german, vars) {
    var i18n = typeof window !== 'undefined' ? window.GAI18n : null;
    if (i18n) return i18n.t(key, vars, german);
    return String(german).replace(/\{([a-zA-Z0-9_]+)\}/g, function (m, n) {
      return vars && Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m;
    });
  }
  function uiLangCs() {
    return root.GAI18n ? root.GAI18n.getLanguage() : 'de';
  }
  function skinLabel(id) {
    var p = providers[id];
    return p ? csText('clock.skin.' + id, p.label) : '';
  }
  try {
    _selected = root.localStorage.getItem(KEY) || 'stopwatch';
  } catch (_) {}
  function current() {
    return providers[_selected] || providers.stopwatch;
  }
  function refresh() {
    var select = root.document.getElementById('mapClockSkin'),
      provider = current();
    if (!provider) return;
    if (select) {
      var signature = Object.keys(providers).join('|') + '|' + uiLangCs();
      if (select._clockOptions !== signature) {
        select._clockOptions = signature;
        while (select.firstChild) select.removeChild(select.firstChild);
        Object.keys(providers).forEach(function (id) {
          var option = root.document.createElement('option');
          option.value = id;
          option.textContent = skinLabel(id);
          select.appendChild(option);
        });
      }
      if (select.value !== _selected) select.value = _selected;
    }
    if (root.GAEfbUiScale && select) {
      if (!choices) {
        choices = root.document.createElement('div');
        choices.setAttribute('role', 'group');
        choices.setAttribute('aria-label', csText('clock.skin.aria', 'Uhrenskin'));
        choices.style.display = 'flex';
        select.parentNode.insertBefore(choices, select);
        select.style.display = 'none';
      }
      if (choices._clockOptions !== Object.keys(providers).join('|') + '|' + uiLangCs()) {
        choices._clockOptions = Object.keys(providers).join('|') + '|' + uiLangCs();
        while (choices.firstChild) choices.removeChild(choices.firstChild);
        Object.keys(providers).forEach(function (id) {
          var b = root.document.createElement('button');
          b.type = 'button';
          b.className = 'pb-btn';
          b.style.flex = '1';
          b.style.margin = '0 2px 6px 0';
          b.textContent = skinLabel(id);
          b.dataset.clockSkin = id;
          b.onclick = function () {
            choose(id);
          };
          choices.appendChild(b);
        });
      }
      Array.prototype.forEach.call(choices.children, function (b) {
        var value = String(b.dataset.clockSkin === _selected);
        if (b.getAttribute('aria-pressed') !== value) b.setAttribute('aria-pressed', value);
      });
    }
    var button = root.document.getElementById('mapToolStopwatch');
    if (button) {
      var shownLabel = csText('clock.skin.' + (providers[_selected] === provider ? _selected : 'stopwatch'), provider.label);
      if (button.title !== shownLabel) button.title = shownLabel;
      var label = csText('clock.skin.open', '{name} öffnen', {
        name: shownLabel
      });
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      button.classList.toggle('active', !!provider.isOpen());
    }
  }
  function choose(id, persist) {
    if (!providers[id]) id = 'stopwatch';
    if (id === _selected) {
      refresh();
      return;
    }
    var previous = current(),
      reopen = previous && previous.isOpen();
    if (previous) previous.close();
    _selected = id;
    try {
      root.localStorage.setItem(KEY, id);
    } catch (_) {}
    if (persist !== false && typeof root.gaPersistDisplayClockSetting === 'function') root.gaPersistDisplayClockSetting('clockSkin', id);
    if (reopen) current().open();
    refresh();
  }
  function register(id, provider) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !provider || typeof provider.open !== 'function' || typeof provider.close !== 'function' || typeof provider.isOpen !== 'function') throw Error('invalid_clock_skin');
    providers[id] = provider;
    refresh();
  }
  root.GAClockSkins = {
    register: register,
    select: choose,
    selected: function selected() {
      return _selected;
    },
    refresh: refresh,
    open: function open() {
      current().open();
      refresh();
    },
    close: function close() {
      current().close();
      refresh();
    },
    isOpen: function isOpen() {
      return !!current().isOpen();
    }
  };
  function install() {
    var _open = root.openMapUtilityTool,
      _close = root.closeMapUtilityTool,
      toggle = root.toggleMapUtilityTool,
      _isOpen = root.isMapUtilityToolOpen;
    if (!_open || !_close || !toggle || !_isOpen) return;
    register('stopwatch', {
      label: 'Stoppuhr',
      open: function open() {
        _open('stopwatch');
      },
      close: function close() {
        _close('stopwatch');
      },
      isOpen: function isOpen() {
        return _isOpen('stopwatch');
      }
    });
    register('watch', {
      label: 'A Watch',
      open: function open() {
        if (root.gaMediaPlayerClient) root.gaMediaPlayerClient.openClock();
      },
      close: function close() {
        if (root.gaMediaPlayerClient) root.gaMediaPlayerClient.closeClock();
      },
      isOpen: function isOpen() {
        return !!(root.gaMediaPlayerClient && root.gaMediaPlayerClient.isClockOpen());
      }
    });
    if (!providers[_selected]) _selected = 'stopwatch';
    root.openMapUtilityTool = function (tool) {
      if (tool === 'stopwatch') {
        current().open();
        refresh();
        return;
      }
      return _open(tool);
    };
    root.closeMapUtilityTool = function (tool) {
      if (tool === 'stopwatch') {
        current().close();
        refresh();
        return;
      }
      return _close(tool);
    };
    root.isMapUtilityToolOpen = function (tool) {
      return tool === 'stopwatch' ? !!current().isOpen() : _isOpen(tool);
    };
    root.toggleMapUtilityTool = function (tool) {
      if (tool !== 'stopwatch') return toggle(tool);
      var p = current();
      if (p.isOpen()) {
        p.close();
        refresh();
        return false;
      }
      p.open();
      refresh();
      return true;
    };
    var select = root.document.getElementById('mapClockSkin');
    if (select) select.onchange = function () {
      choose(select.value);
    };
    refresh();
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install);else install();
  // UI language (web only): redraw the labels when the language changes.
  if (root.GAI18n && typeof root.GAI18n.onChange === 'function') root.GAI18n.onChange(function () {
    refresh();
  });
})(window);
