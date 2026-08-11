(function () {
  'use strict';

  var MAX_EVENTS = 80;
  var events = [];
  var sessionId = 'efb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  var channel = '';

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
