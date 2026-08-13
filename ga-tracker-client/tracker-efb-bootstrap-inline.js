(function () {
  'use strict';

  var MAX_EVENTS = 80;
  var events = [];
  var sessionId = 'efb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  var channel = '';

  function installCompatibilityPolyfills() {
    if (!Number.isFinite) Number.isFinite = function (value) { return typeof value === 'number' && isFinite(value); };
    if (!Number.isInteger) Number.isInteger = function (value) { return Number.isFinite(value) && Math.floor(value) === value; };
    if (!Number.EPSILON) Number.EPSILON = Math.pow(2, -52);
    if (!Math.sign) Math.sign = function (value) { var number = Number(value); return number === 0 || isNaN(number) ? number : (number > 0 ? 1 : -1); };
    if (!Math.hypot) Math.hypot = function () {
      var sum = 0;
      for (var valueIndex = 0; valueIndex < arguments.length; valueIndex += 1) {
        var number = Number(arguments[valueIndex]);
        sum += number * number;
      }
      return Math.sqrt(sum);
    };
    if (!Math.log10) Math.log10 = function (value) { return Math.log(value) / Math.LN10; };
    if (!Object.assign) Object.assign = function (target) {
      if (target == null) throw new TypeError('Object.assign target');
      var output = Object(target);
      for (var sourceIndex = 1; sourceIndex < arguments.length; sourceIndex += 1) {
        var source = arguments[sourceIndex];
        if (source == null) continue;
        Object.keys(Object(source)).forEach(function (key) { output[key] = source[key]; });
      }
      return output;
    };
    if (!Object.values) Object.values = function (source) { return Object.keys(Object(source)).map(function (key) { return source[key]; }); };
    if (!Object.entries) Object.entries = function (source) { return Object.keys(Object(source)).map(function (key) { return [key, source[key]]; }); };
    if (!Array.prototype.includes) Array.prototype.includes = function (value, fromIndex) {
      var length = this.length >>> 0;
      var index = Math.max(Number(fromIndex) || 0, 0);
      while (index < length) {
        var current = this[index];
        if (current === value || (current !== current && value !== value)) return true;
        index += 1;
      }
      return false;
    };
    if (!Array.prototype.find) Array.prototype.find = function (predicate, thisArg) {
      if (typeof predicate !== 'function') throw new TypeError('Array.find predicate');
      for (var findIndex = 0; findIndex < this.length; findIndex += 1) {
        if (predicate.call(thisArg, this[findIndex], findIndex, this)) return this[findIndex];
      }
      return undefined;
    };
    if (!Array.prototype.flatMap) Array.prototype.flatMap = function (callback, thisArg) {
      if (typeof callback !== 'function') throw new TypeError('Array.flatMap callback');
      var result = [];
      for (var flatIndex = 0; flatIndex < this.length; flatIndex += 1) {
        if (!(flatIndex in this)) continue;
        var mapped = callback.call(thisArg, this[flatIndex], flatIndex, this);
        if (Array.isArray(mapped)) Array.prototype.push.apply(result, mapped);
        else result.push(mapped);
      }
      return result;
    };
    if (!String.prototype.includes) String.prototype.includes = function (value, start) { return this.indexOf(value, start || 0) >= 0; };
    if (!String.prototype.startsWith) String.prototype.startsWith = function (value, start) { return this.slice(start || 0, (start || 0) + String(value).length) === String(value); };
    if (!String.prototype.endsWith) String.prototype.endsWith = function (value) { var text = String(value); return this.slice(this.length - text.length) === text; };
    if (!String.prototype.trimStart) String.prototype.trimStart = function () { return String(this).replace(/^\s+/, ''); };
    if (!String.prototype.trimEnd) String.prototype.trimEnd = function () { return String(this).replace(/\s+$/, ''); };
    if (!String.prototype.padStart) String.prototype.padStart = function (length, fill) {
      var value = String(this);
      var target = Math.max(0, Number(length) || 0);
      var padding = String(fill == null ? ' ' : fill) || ' ';
      while (value.length < target) value = padding.slice(0, target - value.length) + value;
      return value;
    };
    if (!String.prototype.padEnd) String.prototype.padEnd = function (length, fill) {
      var value = String(this);
      var target = Math.max(0, Number(length) || 0);
      var padding = String(fill == null ? ' ' : fill) || ' ';
      while (value.length < target) value += padding.slice(0, target - value.length);
      return value;
    };
    if (window.NodeList && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach;
    if (window.Element && !Element.prototype.matches) Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
    if (window.Element && !Element.prototype.closest) Element.prototype.closest = function (selector) {
      var node = this;
      while (node && node.nodeType === 1) {
        if (node.matches && node.matches(selector)) return node;
        node = node.parentElement;
      }
      return null;
    };
    if (window.Element && !Element.prototype.replaceChildren) Element.prototype.replaceChildren = function () {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var index = 0; index < arguments.length; index += 1) {
        var child = arguments[index];
        this.appendChild(child && child.nodeType ? child : document.createTextNode(String(child)));
      }
    };
    if (window.Element && !Element.prototype.remove) Element.prototype.remove = function () {
      if (this.parentNode) this.parentNode.removeChild(this);
    };
  }

  installCompatibilityPolyfills();

  function text(value, limit) {
    return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').slice(0, limit || 240);
  }

  function readQuery(name) {
    var query = String(window.location.search || '').replace(/^\?/, '').split('&');
    for (var index = 0; index < query.length; index += 1) {
      var pair = query[index].split('=');
      if (decodeURIComponent(pair[0] || '') === name) {
        try { return decodeURIComponent(pair.slice(1).join('=') || ''); } catch (_) { return ''; }
      }
    }
    return '';
  }

  channel = text(readQuery('channel'), 120);

  function post(entry) {
    try {
      var request = new XMLHttpRequest();
      request.open('POST', '/api/v1/client-log', true);
      request.setRequestHeader('Content-Type', 'application/json');
      request.send(JSON.stringify(entry));
    } catch (_) {}
  }

  function report(level, event, stage, message, details) {
    var entry = {
      level: text(level || 'info', 12),
      event: text(event || 'client', 48),
      stage: text(stage || '', 80),
      message: text(message || '', 320),
      details: text(details || '', 800),
      sessionId: sessionId,
      channel: channel,
      at: Date.now()
    };
    events.push(entry);
    if (events.length > MAX_EVENTS) events.shift();
    post(entry);
    return entry;
  }

  function status(stage, message, isError) {
    var node = document.getElementById('gaEfbBootStatus');
    if (node) {
      node.textContent = message || stage || '';
      node.className = isError ? 'ga-efb-boot-status error' : 'ga-efb-boot-status';
    }
    report(isError ? 'error' : 'info', 'boot', stage, message || '');
  }

  function notifyParent(state, detail) {
    var payload = detail || {};
    try {
      window.parent.postMessage({
        type: 'ga-efb-kartentisch',
        state: text(state, 32),
        channel: channel,
        stage: text(payload.stage || '', 80),
        message: text(payload.message || '', 240)
      }, '*');
      report('info', 'parent-message', state, payload.message || '');
    } catch (error) {
      report('error', 'parent-message', state, error && error.message || error);
    }
  }

  function safeClose(reason) {
    if (document.body) document.body.classList.add('map-is-fullscreen');
    document.documentElement.classList.add('map-is-fullscreen');
    report('info', 'close', reason || 'button', 'Schliessen an EFB-Host gemeldet');
    notifyParent('close', { stage: reason || 'button' });
    return false;
  }

  window.__gaEfbChannel = channel;
  window.__gaEfbDiagnostics = events;
  window.__gaEfbReport = report;
  window.__gaEfbBoot = status;
  window.__gaEfbNotifyParent = notifyParent;
  window.__gaEfbScriptLoaded = function (name) {
    status('script:' + text(name, 40), text(name, 40) + ' geladen', false);
  };
  window.__gaEfbScriptError = function (name) {
    status('script:' + text(name, 40), text(name, 40) + ' konnte nicht geladen werden', true);
  };

  // Diese Funktionen muessen vor allen grossen App-Skripten existieren. Das
  // originale Kartentisch-Markup kann sie sonst bereits beim ersten Klick aufrufen.
  window.toggleMapTable = function () { return safeClose('toggle-map-table'); };
  window.closeWin95OverlayWindow = function () { return safeClose('window-close'); };
  window.minimizeWin95OverlayWindow = function () { report('info', 'early-action', 'minimize', 'Host noch nicht initialisiert'); };
  window.resetMainRoute = function () { report('info', 'early-action', 'route-reset', 'Read-only im EFB'); };
  window.toggleMapProfile = function () { report('info', 'early-action', 'profile', 'Host noch nicht initialisiert'); };
  window.toggleMapToolbar = function () { report('info', 'early-action', 'toolbar', 'Host noch nicht initialisiert'); };

  window.addEventListener('error', function (event) {
    var target = event && event.target;
    var source = target && (target.src || target.href);
    var tagName = String(target && target.tagName || '').toUpperCase();
    if (source && ['SCRIPT', 'LINK', 'IFRAME'].indexOf(tagName) < 0) return;
    report('error', source ? 'resource-error' : 'window-error', source || event.filename || '', event.message || 'Unbekannter Skriptfehler', event.lineno || '');
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    report('error', 'unhandled-rejection', 'promise', reason && reason.message || reason || 'Unbekannte Promise-Ablehnung');
  });
  document.addEventListener('DOMContentLoaded', function () {
    status('dom-ready', 'Kartentisch-DOM bereit', false);
  });

  report('info', 'boot', 'inline-bootstrap', 'Inline-Bootstrap aktiv');
  notifyParent('boot', { stage: 'inline-bootstrap' });
})();
