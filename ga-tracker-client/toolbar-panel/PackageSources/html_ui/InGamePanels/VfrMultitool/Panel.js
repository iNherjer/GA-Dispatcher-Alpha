/* Thin toolbar host for the same tracker-owned cockpit UI as the EFB. */
(function () {
  'use strict';
  var base = 'http://127.0.0.1:49880';
  var panel = document.getElementById('VfrMultitoolPanel');
  var container = document.getElementById('vfr-frame-container');
  var status = document.getElementById('vfr-status');
  var offline = document.getElementById('vfr-offline');
  var bar = document.getElementById('vfr-statusbar');
  var controlsFrame = null;
  var active = false, generation = 0, timer = null, request = null, frame = null;
  var channel = '', ready = false, deadline = 0;
  var vrWatcher = null;
  function sendDisplayMode() {
    if (!active || !frame || !window.GAVrMode) return;
    var mode = vrWatcher ? vrWatcher.read() : window.GAVrMode.read(window);
    if (mode === null) return;
    frame.contentWindow.postMessage({ type: 'ga-efb-display-mode', channel: channel, vr: mode, surface: 'toolbar' }, base);
  }
  function log(message) { console.log('[VFR_TOOLBAR 0.2.1] ' + message); }
  function clearFrame() {
    ready = false;
    if (frame) { container.removeChild(frame); frame = null; }
    offline.style.display = '';
    bar.style.display = '';
  }
  function stop(reason) {
    active = false; generation++;
    clearTimeout(timer); timer = null;
    if (vrWatcher) { vrWatcher.stop(); vrWatcher = null; }
    if (request) { request.abort(); request = null; }
    clearFrame(); log('suspend ' + reason);
  }
  function schedule(delay) {
    clearTimeout(timer);
    if (active) timer = setTimeout(check, delay);
  }
  function check() {
    if (!active || request) return;
    if (frame && !ready && Date.now() > deadline) {
      status.textContent = 'Kartentisch antwortet nicht. Bitte Neu verbinden wählen.';
      bar.style.display = ''; log('ready-timeout'); return;
    }
    var epoch = generation;
    var xhr = new XMLHttpRequest(); request = xhr;
    xhr.open('GET', base + '/api/v1/snapshot', true); xhr.timeout = 3000;
    function finish(ok) {
      if (epoch !== generation) return;
      request = null;
      if (!ok) {
        bar.style.display = '';
        status.textContent = 'Tracker nicht erreichbar – warte auf Verbindung';
        // A short outage never discards an already visible frame.
        schedule(4000); return;
      }
      if (!frame) {
        frame = document.createElement('iframe');
        frame.title = 'VFR Multitool Kartentisch';
        channel = 'toolbar-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        var vr = window.GAVrMode && window.GAVrMode.read(window) === true;
        frame.src = base + '/efb/v1/?host=toolbar&channel=' + encodeURIComponent(channel) + '&view=10&surface=toolbar&vr=' + (vr ? '1' : '0');
        deadline = Date.now() + 20000;
        var loadCount = 0;
        frame.onload = function () {
          if (epoch !== generation) return;
          loadCount++;
          if (loadCount > 1) { ready = false; deadline = Date.now() + 20000; schedule(4000); }
          log('frame-load ' + channel);
          sendDisplayMode();
        };
        container.appendChild(frame);
        status.textContent = 'Tracker verbunden – Kartentisch startet'; log('start ' + channel);
      }
      schedule(4000);
    }
    xhr.onload = function () { finish(xhr.status === 200); };
    xhr.onerror = xhr.ontimeout = function () { finish(false); };
    xhr.send();
  }
  function start() {
    if (active) return;
    active = true; generation++;
    if (window.GAVrMode) vrWatcher = window.GAVrMode.watch(window, sendDisplayMode);
    log('resume'); check();
  }
  function visible() {
    return !document.hidden && panel.active === true && panel.visible !== false && !panel.minimized;
  }
  function sync() {
    if (!document.hidden && panel.active === true && panel.visible !== false) {
      if (controlsFrame === null) positionControls();
    } else if (controlsFrame !== null) {
      window.cancelAnimationFrame(controlsFrame); controlsFrame = null;
    }
    if (visible()) start(); else if (active) stop('native-hidden');
  }
  // Keep the simulator's own icon-buttons and OnValidate handlers. They are
  // part of its pointer/navigation and toolbar lifecycle, including VR.
  function positionControls() {
    var header = panel.querySelector('ingame-ui-header');
    if (header) {
      var actions = header.querySelector('.action-list');
      var anchor = header.querySelector('.anchor');
      var icons = header.querySelector('.icons');
      var closeButton = header.querySelector('.Close');
      if (anchor && icons && closeButton && icons.parentElement !== anchor) {
        anchor.insertBefore(icons, closeButton);
      }
      header.classList.add('vfr-native-actions');
      // setVisible updates native navigation state too; CSS alone would leave
      // cockpit-attached actions invisible to the simulator input system.
      var nativeButtons = [['.Reduce', !panel.minimized], ['.Maximize', panel.minimized], ['.Close', true]];
      for (var i = 0; i < nativeButtons.length; i++) {
        var button = header.querySelector(nativeButtons[i][0]);
        var show = nativeButtons[i][1];
        if (button && typeof button.setVisible === 'function' && button.classList.contains('hide') === show) {
          button.setVisible(show);
        }
      }
      var rect = header.getBoundingClientRect();
      var scale = header.offsetHeight > 0 ? rect.height / header.offsetHeight : 1;
      if (!(scale > 0)) scale = 1;
      var height = Math.max(28, Math.min(64, rect.height * 0.8));
      var cssHeight = height / scale + 'px';
      var cssWidth = height * 1.125 / scale + 'px';
      if (header.style.getPropertyValue('--vfr-native-action-height') !== cssHeight) {
        header.style.setProperty('--vfr-native-action-height', cssHeight);
      }
      if (header.style.getPropertyValue('--vfr-native-action-width') !== cssWidth) {
        header.style.setProperty('--vfr-native-action-width', cssWidth);
      }
      if (actions && !actions.vfrDiagnosticsBound) {
        actions.vfrDiagnosticsBound = true;
        actions.addEventListener('OnValidate', function (event) {
          log('native-validate ' + JSON.stringify(diagnostics(event)));
        }, true);
        actions.addEventListener('click', function (event) {
          log('native-click ' + JSON.stringify(diagnostics(event)));
        }, true);
      }
    }
    controlsFrame = window.requestAnimationFrame(positionControls);
  }
  function diagnostics(event) {
    var header = panel.querySelector('ingame-ui-header');
    var hit = event && typeof event.clientX === 'number' ? document.elementFromPoint(event.clientX, event.clientY) : null;
    function describe(element) { return element ? element.tagName + '.' + element.className : null; }
    return {
      panelId: panel.getAttribute('panel-id'), active: panel.active, attached: panel.attached,
      minimized: panel.minimized, closePanel: typeof panel.closePanel,
      ToggleMinimized: typeof panel.ToggleMinimized, target: describe(event && event.target),
      propagationStopped: event ? event.cancelBubble : null,
      actions: header ? ['.Reduce', '.Maximize', '.Close', '.Detach', '.Extern'].map(function (selector) {
        var button = header.querySelector(selector);
        if (!button) return { selector: selector, present: false };
        var r = button.getBoundingClientRect();
        return { selector: selector, nativeVisible: typeof button.isVisible === 'function' ? button.isVisible() : null,
          left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }) : [],
      hit: describe(hit), header: header ? (function () { var r = header.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; }()) : null
    };
  }
  window.VfrToolbarDiagnostics = diagnostics;
  document.getElementById('vfr-retry').onclick = function () { stop('retry'); if (visible()) start(); };
  function close() {
    stop('close'); if (typeof panel.closePanel === 'function') panel.closePanel();
  }
  document.getElementById('vfr-close').onclick = close;
  window.addEventListener('message', function (event) {
    if (!active || !frame) return;
    var data = event.data;
    if (!data || data.type !== 'ga-efb-kartentisch' || !channel || data.channel !== channel) return;
    // Coherent may omit source. A known foreign window is never accepted.
    if (event.source != null && event.source !== frame.contentWindow) return;
    if (event.source == null && event.origin !== base) return;
    if (event.origin && event.origin !== 'null' && event.origin !== base) return;
    if (data.state === 'close') { close(); return; }
    if (data.state === 'ready' || data.state === 'live') {
      ready = true; offline.style.display = 'none'; bar.style.display = 'none';
      status.textContent = 'Kartentisch mit Tracker verbunden';
      log(data.state + ' ' + channel);
      sendDisplayMode();
    } else if (data.state === 'error') {
      bar.style.display = '';
      status.textContent = 'Kartentisch: Verbindung oder Laden gestört – Neu verbinden bei Bedarf';
      log('host-error ' + String(data.stage || '').slice(0, 80));
    }
  });
  panel.addEventListener('panelActive', sync);
  panel.addEventListener('panelInactive', sync);
  document.addEventListener('visibilitychange', sync);
  // Native visibility/minimize changes do not all dispatch panelInactive.
  new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('pagehide', function () {
    if (controlsFrame !== null) window.cancelAnimationFrame(controlsFrame);
    controlsFrame = null; stop('pagehide');
  });
  window.addEventListener('pageshow', sync);
  sync();
}());
