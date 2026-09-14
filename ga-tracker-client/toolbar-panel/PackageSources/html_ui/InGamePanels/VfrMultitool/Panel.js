/* Thin toolbar host for the same tracker-owned cockpit UI as the EFB. */
(function () {
  'use strict';
  var base = 'http://127.0.0.1:49880';
  var panel = document.getElementById('VfrMultitoolPanel');
  var container = document.getElementById('vfr-frame-container');
  var status = document.getElementById('vfr-status');
  var offline = document.getElementById('vfr-offline');
  var bar = document.getElementById('vfr-statusbar');
  var active = false, generation = 0, timer = null, request = null, frame = null;
  var channel = '', ready = false, deadline = 0;
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
        frame.src = base + '/efb/v1/?host=toolbar&channel=' + encodeURIComponent(channel) + '&view=9';
        deadline = Date.now() + 20000;
        var loadCount = 0;
        frame.onload = function () {
          if (epoch !== generation) return;
          loadCount++;
          if (loadCount > 1) { ready = false; deadline = Date.now() + 20000; schedule(4000); }
          log('frame-load ' + channel);
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
    active = true; generation++; log('resume'); check();
  }
  function visible() {
    return !document.hidden && panel.active === true && panel.visible !== false && !panel.minimized;
  }
  function sync() { if (visible()) start(); else if (active) stop('native-hidden'); }
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
  window.addEventListener('pagehide', function () { stop('pagehide'); });
  window.addEventListener('pageshow', sync);
  sync();
}());
