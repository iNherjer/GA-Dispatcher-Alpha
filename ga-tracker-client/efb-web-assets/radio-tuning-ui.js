// Generated from radio-tuning-ui.js by sync-efb-web-assets.js. Do not edit.
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
/* Shared App/EFB frequency controls; explicit markup only. */
(function () {
  var core = window.GARadioTuningCore;
  if (!core) return;
  var modes = ['off', 'direct', 'select'];
  var mode = 'off',
    dialog = null,
    source = null,
    busy = false;
  try {
    var saved = localStorage.getItem('ga-navcom-mode-v1');
    if (modes.indexOf(saved) >= 0) mode = saved;
  } catch (_) {}
  var labels = {
    off: 'AUS',
    direct: 'Gerät 1 aktiv',
    select: 'Auswahl'
  };
  function each(nodes, fn) {
    Array.prototype.forEach.call(nodes, fn);
  }
  var nativeEfb = document.body && document.body.classList.contains('ga-efb-tracker-host');
  function radioNode(target) {
    while (target && target !== document) {
      if (target.nodeType === 1 && target.classList.contains('ga-radio-value')) return target;
      target = target.parentNode;
    }
    return null;
  }
  function bindNativeInput(node) {
    if (!nativeEfb || node._gaRadioInputBound) return;
    node._gaRadioInputBound = true;
    // Coherent controls also need a handler on the actual DOM element.
    node.onclick = function (event) {
      activate(event, node);
    };
    ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend'].forEach(type => {
      node.addEventListener(type, function (event) {
        // Keep draggable windows and dismissible banners from consuming
        // the gesture; do not cancel native click synthesis.
        if (mode !== 'off') event.stopPropagation();
      });
    });
  }
  function refresh() {
    document.body.setAttribute('data-navcom-mode', mode);
    var button = document.getElementById('navcomModeBtn');
    if (button && button.textContent !== 'NAVCOM: ' + labels[mode]) button.textContent = 'NAVCOM: ' + labels[mode];
    each(document.querySelectorAll('.ga-radio-value'), node => {
      bindNativeInput(node);
      node.tabIndex = mode === 'off' ? -1 : 0;
      node.setAttribute('aria-disabled', mode === 'off' ? 'true' : 'false');
    });
  }
  function close() {
    if (dialog) dialog.remove();
    dialog = null;
    if (source && source.isConnected) source.focus();
    source = null;
  }
  function notify(message) {
    if (typeof window.showMapToast === 'function') {
      window.showMapToast(message, 4500);
      return;
    }
    var toast = document.getElementById('gaRadioStatus');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gaRadioStatus';
      toast.className = 'ga-radio-status';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      toast.hidden = true;
    }, 5000);
  }
  var errors = {
    simulator_not_connected: 'Simulator nicht verbunden.',
    tracker_not_connected: 'Tracker nicht verbunden.',
    radio_unavailable: 'Der verbundene Tracker unterstützt NAVCOM noch nicht.',
    cockpit_tool_not_allowed: 'Der verbundene Tracker unterstützt NAVCOM noch nicht.',
    radio_not_confirmed: 'Übernahme nicht bestätigt. Bitte das Gerät im Cockpit prüfen.',
    radio_readback_timeout: 'Keine Bestätigung vom Simulator. Bitte das Gerät im Cockpit prüfen.',
    authority_timeout: 'Keine Tracker-Bestätigung. Bitte das Gerät im Cockpit prüfen.',
    radio_busy: 'Eine Übernahme läuft bereits.',
    radio_frequency_invalid: 'Diese Frequenz kann nicht eingestellt werden.',
    squawk_invalid: 'Ungültiger Squawk-Code.'
  };
  function send(_x, _x2, _x3) {
    return _send.apply(this, arguments);
  }
  function _send() {
    _send = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(spec, index, slot) {
      var payload, result, target, _t;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.p = _context.n) {
          case 0:
            if (!busy) {
              _context.n = 1;
              break;
            }
            return _context.a(2);
          case 1:
            busy = true;
            if (dialog) each(dialog.querySelectorAll('button'), b => {
              b.disabled = true;
            });
            _context.p = 2;
            payload = {
              kind: spec.kind,
              value: spec.value,
              index,
              slot
            };
            core.normalize(payload);
            if (!(typeof window.gaRadioTune !== 'function')) {
              _context.n = 3;
              break;
            }
            throw new Error('radio_unavailable');
          case 3:
            _context.n = 4;
            return window.gaRadioTune(payload);
          case 4:
            result = _context.v;
            if (!(!result || !result.ok || !result.confirmed)) {
              _context.n = 5;
              break;
            }
            throw new Error(result && result.error || 'radio_not_confirmed');
          case 5:
            target = result.target;
            close();
            notify(target.kind === 'XPDR' ? 'Transponder: ' + target.value : target.kind + target.index + ' ' + (target.slot === 'active' ? 'aktiv' : 'Standby') + ': ' + target.value + (target.kind === 'ADF' ? ' kHz' : ' MHz'));
            _context.n = 7;
            break;
          case 6:
            _context.p = 6;
            _t = _context.v;
            notify(errors[_t.message] || 'Übernahme nicht bestätigt. Bitte Verbindung und Cockpitgerät prüfen.');
          case 7:
            _context.p = 7;
            busy = false;
            if (dialog) each(dialog.querySelectorAll('button'), b => {
              b.disabled = false;
            });
            return _context.f(7);
          case 8:
            return _context.a(2);
        }
      }, _callee, null, [[2, 6, 7, 8]]);
    }));
    return _send.apply(this, arguments);
  }
  function open(node, spec) {
    close();
    source = node;
    dialog = document.createElement('div');
    dialog.className = 'ga-radio-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'false');
    dialog.setAttribute('aria-label', 'Frequenz übernehmen');
    dialog.innerHTML = '<div class="ga-radio-heading"><b>' + core.escape(spec.value) + (spec.kind === 'XPDR' ? '' : spec.kind === 'ADF' ? ' kHz' : ' MHz') + '</b><button type="button" class="pb-btn ga-radio-close" aria-label="Schließen">✕</button></div><div class="ga-radio-choices"></div><button type="button" class="pb-btn ga-radio-back">Zurück</button>';
    document.body.appendChild(dialog);
    var rect = node.getBoundingClientRect();
    // The native EFB scales the whole body. Convert screen coordinates back
    // to that containing block instead of scaling the position a second time.
    var scale = dialog.getBoundingClientRect().width / dialog.offsetWidth || 1;
    var transformedBody = window.getComputedStyle(document.body).transform !== 'none';
    var origin = transformedBody ? document.body.getBoundingClientRect() : {
      left: 0,
      top: 0
    };
    var width = window.innerWidth / scale,
      height = window.innerHeight / scale;
    dialog.style.width = Math.min(240, width - 16) + 'px';
    dialog.style.maxHeight = Math.max(80, height - 16) + 'px';
    dialog.style.overflowY = 'auto';
    dialog.style.left = Math.max(8, Math.min((rect.left - origin.left) / scale, width - dialog.offsetWidth - 8)) + 'px';
    var choices = dialog.querySelector('.ga-radio-choices');
    var back = dialog.querySelector('.ga-radio-back');
    dialog.querySelector('.ga-radio-close').onclick = close;
    var heading = dialog.querySelector('.ga-radio-heading b');
    var headingText = heading.textContent;
    function deviceStep() {
      heading.textContent = headingText;
      back.style.visibility = 'hidden';
      choices.innerHTML = '<button type="button" class="pb-btn">' + (spec.kind === 'XPDR' ? 'Transponder' : spec.kind + '1') + '</button><button type="button" class="pb-btn">' + (spec.kind === 'XPDR' ? '' : spec.kind + '2') + '</button>';
      var buttons = choices.querySelectorAll('button');
      buttons[1].style.visibility = spec.kind === 'XPDR' ? 'hidden' : 'visible';
      each(buttons, (button, i) => {
        button.onclick = () => slotStep(i + 1);
      });
      buttons[0].focus();
    }
    function slotStep(index) {
      heading.textContent = (spec.kind === 'XPDR' ? 'XPDR' : spec.kind + index) + ' · ' + headingText;
      back.style.visibility = 'visible';
      back.onclick = deviceStep;
      choices.innerHTML = '<button type="button" class="pb-btn">' + (spec.kind === 'XPDR' ? 'Code setzen' : 'Aktiv') + '</button><button type="button" class="pb-btn">Standby</button>';
      var buttons = choices.querySelectorAll('button');
      buttons[1].style.visibility = spec.kind === 'XPDR' ? 'hidden' : 'visible';
      buttons[0].onclick = () => send(spec, index, 'active');
      buttons[1].onclick = () => send(spec, index, 'standby');
      buttons[0].focus();
    }
    deviceStep();
    dialog.style.top = Math.max(8, Math.min((rect.bottom - origin.top) / scale + 6, height - dialog.offsetHeight - 8)) + 'px';
  }
  function activate(event, boundNode) {
    var node = boundNode || radioNode(event.target);
    if (!node || mode === 'off') return;
    if (event.preventDefault) event.preventDefault();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();else if (event.stopPropagation) event.stopPropagation();
    if (busy) return;
    var spec = {
      kind: node.dataset.radioKind,
      value: node.dataset.radioValue
    };
    if (mode === 'direct') send(spec, 1, 'active');else open(node, spec);
  }
  window.gaGetNavcomMode = function () {
    return mode;
  };
  window.gaSetNavcomMode = function (value, persist) {
    if (modes.indexOf(value) < 0) return;
    if (mode === value && persist === false) return;
    mode = value;
    try {
      localStorage.setItem('ga-navcom-mode-v1', mode);
    } catch (_) {}
    close();
    refresh();
    if (persist !== false && window.gaPersistNavcomMode) window.gaPersistNavcomMode(mode);
  };
  window.gaCycleNavcomMode = function () {
    window.gaSetNavcomMode(modes[(modes.indexOf(mode) + 1) % modes.length]);
  };
  function install() {
    refresh();
    document.addEventListener('click', function (event) {
      if (radioNode(event.target) && mode !== 'off') {
        activate(event);
        return;
      }
      if (dialog && !busy && !dialog.contains(event.target)) close();
    }, true);
    ['pointerdown', 'mousedown', 'touchstart'].forEach(type => document.addEventListener(type, function (event) {
      if (!nativeEfb && mode !== 'off' && radioNode(event.target)) event.stopImmediatePropagation();
    }, true));
    // Capture release events before the frequency banner's dismiss listener.
    ['pointerup', 'touchend'].forEach(type => document.addEventListener(type, function (event) {
      if (!nativeEfb && mode !== 'off' && radioNode(event.target)) event.stopImmediatePropagation();
    }, true));
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && dialog && !busy) {
        event.preventDefault();
        close();
      } else if (event.key === 'Enter' || event.key === ' ') activate(event);
    }, true);
    var observed = false;
    try {
      if (typeof window.MutationObserver === 'function') {
        new window.MutationObserver(refresh).observe(document.body, {
          childList: true,
          subtree: true
        });
        observed = true;
      }
    } catch (_) {}
    // Dynamic airport/telemetry fields must remain usable on hosts without
    // MutationObserver. Installing input never depends on this optional API.
    if (!observed) setInterval(refresh, 500);
    if (typeof window.__gaEfbReport === 'function') {
      window.__gaEfbReport('info', 'navcom-ready', 'radio-tuning-ui', mode, {
        nativeInput: nativeEfb,
        observer: observed
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);else install();
})();
