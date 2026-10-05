/* Thin toolbar host for the same tracker-owned cockpit UI as the EFB. */
(function () {
  'use strict';
  var base = 'http://127.0.0.1:49880';
  var panel = document.getElementById('VfrMultitoolPanel');
  var container = document.getElementById('vfr-frame-container');
  var status = document.getElementById('vfr-status');
  var offline = document.getElementById('vfr-offline');
  var bar = document.getElementById('vfr-statusbar');
  var controls = document.getElementById('vfr-window-controls');
  var minimizeButton = document.getElementById('vfr-minimize');
  var controlsFrame = null;
  var active = false, generation = 0, timer = null, request = null, frame = null;
  var channel = '', ready = false, deadline = 0;
  var vrWatcher = null;
  function sendDisplayMode() {
    if (!active || !frame || !window.GAVrMode) return;
    var mode = vrWatcher ? vrWatcher.read() : window.GAVrMode.read(window);
    if (mode === null) return;
    frame.contentWindow.postMessage({ type: 'ga-efb-display-mode', channel: channel, vr: mode }, base);
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
        frame.src = base + '/efb/v1/?host=toolbar&channel=' + encodeURIComponent(channel) + '&view=10&vr=' + (vr ? '1' : '0');
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
    controls.hidden = document.hidden || panel.active !== true || panel.visible === false;
    if (!controls.hidden && controlsFrame === null) positionControls();
    if (controls.hidden && controlsFrame !== null) {
      window.cancelAnimationFrame(controlsFrame); controlsFrame = null;
    }
    minimizeButton.setAttribute('aria-expanded', panel.minimized ? 'false' : 'true');
    minimizeButton.setAttribute('aria-label', panel.minimized ? 'Wiederherstellen' : 'Minimieren');
    minimizeButton.title = panel.minimized ? 'Wiederherstellen' : 'Minimieren';
    if (visible()) start(); else if (active) stop('native-hidden');
  }
  function positionControls() {
    var rect = panel.getBoundingClientRect();
    var header = panel.querySelector('ingame-ui-header');
    var headerRect = header ? header.getBoundingClientRect() : null;
    var height = headerRect && headerRect.height > 0 ? headerRect.height : 40;
    // Screen rectangles already include Coherent's native UI transform. Convert
    // their dimensions back to the overlay's CSS coordinates before sizing.
    var buttonRect = minimizeButton.getBoundingClientRect ? minimizeButton.getBoundingClientRect() : null;
    var scaleY = buttonRect && minimizeButton.offsetHeight > 0 ? buttonRect.height / minimizeButton.offsetHeight : 1;
    var scaleX = buttonRect && minimizeButton.offsetWidth > 0 ? buttonRect.width / minimizeButton.offsetWidth : 1;
    if (!(scaleY > 0)) scaleY = 1;
    if (!(scaleX > 0)) scaleX = 1;
    // Icon strokes need the same compensation as their hit targets.
    if (typeof controls.style.setProperty === 'function') {
      controls.style.setProperty('--vfr-icon-stroke', (2 / Math.min(scaleX, scaleY)) + 'px');
    }
    var screenHeight = Math.max(28, Math.min(64, height * 0.8));
    var buttonHeight = screenHeight / scaleY;
    var buttonWidth = screenHeight * 1.125 / scaleX;
    var actions = header ? header.querySelector('.action-list') : null;
    var actionsRect = actions ? actions.getBoundingClientRect() : null;
    var edge = actionsRect && actionsRect.width > 0 ? actionsRect.left - 4 : rect.right - 8;
    var targetTop = Math.max(0, (headerRect ? headerRect.top : rect.top) + (height - screenHeight) / 2);
    var targetRight = Math.max(0, window.innerWidth - edge);
    var overlayRect = controls.getBoundingClientRect ? controls.getBoundingClientRect() : null;
    var top = overlayRect ? (parseFloat(controls.style.top) || 0) + (targetTop - overlayRect.top) / scaleY : targetTop;
    var right = overlayRect ? (parseFloat(controls.style.right) || 0) + (overlayRect.right - (window.innerWidth - targetRight)) / scaleX : targetRight;
    top += 'px'; right += 'px';
    if (controls.style.top !== top) controls.style.top = top;
    if (controls.style.right !== right) controls.style.right = right;
    var buttons = [minimizeButton, document.getElementById('vfr-window-close')];
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].style.height !== buttonHeight + 'px') buttons[i].style.height = buttonHeight + 'px';
      if (buttons[i].style.width !== buttonWidth + 'px') buttons[i].style.width = buttonWidth + 'px';
    }
    // Reserve room in the native title without covering its action buttons.
    var titleWrap = header ? header.querySelector('.wrap') : null;
    var headerScaleX = headerRect && header.offsetWidth > 0 ? headerRect.width / header.offsetWidth : scaleX;
    if (!(headerScaleX > 0)) headerScaleX = scaleX;
    var titlePadding = (screenHeight * 1.125 * 2 + 12) / headerScaleX;
    if (titleWrap && titleWrap.style.paddingRight !== titlePadding + 'px') {
      titleWrap.style.paddingRight = titlePadding + 'px';
    }
    controlsFrame = window.requestAnimationFrame(positionControls);
  }
  document.getElementById('vfr-retry').onclick = function () { stop('retry'); if (visible()) start(); };
  function close() {
    stop('close'); if (typeof panel.closePanel === 'function') panel.closePanel();
  }
  document.getElementById('vfr-close').onclick = close;
  document.getElementById('vfr-window-close').onclick = close;
  minimizeButton.onclick = function () {
    if (typeof panel.ToggleMinimized === 'function') panel.ToggleMinimized();
    sync();
  };
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
    controls.hidden = true;
    if (controlsFrame !== null) window.cancelAnimationFrame(controlsFrame);
    controlsFrame = null; stop('pagehide');
  });
  window.addEventListener('pageshow', sync);
  sync();
}());
