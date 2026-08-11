'use strict';

const EFB_WEB_CLIENT_PATH = '/efb/v1/';

function createTrackerEfbWebClientPage() {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>VFR Multitool EFB Server Probe</title>
  <style>
    :root { color-scheme: dark; font-family: Arial, sans-serif; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #06121d; color: #eef7fb; }
    body { display: flex; align-items: center; justify-content: center; padding: 5rem 1rem 1rem; }
    main { width: min(42rem, 100%); border: 1px solid #406276; border-radius: 12px; background: #0a2030; box-shadow: 0 12px 36px #0009; }
    header, section { padding: .85rem 1rem; }
    header { border-bottom: 1px solid #29485b; }
    h1 { margin: 0 0 .2rem; font-size: 1.05rem; }
    p { margin: .25rem 0; color: #a8bdc9; font-size: .82rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem; }
    .card { min-height: 5rem; padding: .65rem; border: 1px solid #29485b; border-radius: 8px; background: #0d2a3e; }
    .label { display: block; margin-bottom: .3rem; color: #79d9cd; font-size: .68rem; font-weight: 700; text-transform: uppercase; }
    .value { overflow-wrap: anywhere; font-family: Consolas, monospace; font-size: .82rem; }
    .actions { display: flex; gap: .6rem; }
    button { min-height: 2.6rem; flex: 1; border: 1px solid #69ded0; border-radius: 7px; color: #061713; background: #69ded0; font: 700 .85rem Arial, sans-serif; }
    button:active { transform: translateY(1px); background: #a5f0e7; }
    body.alt { background: #201b0d; color: #fff7d8; }
    body.alt main { border-color: #d4ab45; background: #2d260f; }
    body.alt .card { border-color: #7e682d; background: #3c3216; }
    body.alt .label { color: #f1c85b; }
    .ok { color: #79e6a4; }
    .error { color: #ff9a9a; }
    @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } body { padding-right: .55rem; padding-left: .55rem; } }
  </style>
</head>
<body>
  <main data-probe-version="1">
    <header>
      <h1>Tracker-hosted EFB client probe</h1>
      <p>Nur Transport-, Eingabe-, Resize- und Snapshot-Test. Noch kein Kartentisch.</p>
    </header>
    <section class="grid">
      <div class="card"><span class="label">Verbindung</span><span id="connection" class="value">Warte auf Tracker</span></div>
      <div class="card"><span class="label">Viewport</span><span id="viewport" class="value">-</span></div>
      <div class="card"><span class="label">Flug</span><span id="flight" class="value">Noch keine Daten</span></div>
      <div class="card"><span class="label">Eingabe</span><span id="input" class="value">0 Klicks</span></div>
    </section>
    <section class="actions">
      <button id="clickTest" type="button">Klicktest</button>
      <button id="themeTest" type="button">Kontrast</button>
    </section>
  </main>
  <script>
    (function () {
      'use strict';
      var clicks = 0;
      var connection = document.getElementById('connection');
      var viewport = document.getElementById('viewport');
      var flight = document.getElementById('flight');
      var input = document.getElementById('input');
      function notify(state) {
        try { window.parent.postMessage({ type: 'ga-efb-server-probe', state: state, clicks: clicks }, '*'); } catch (_) {}
      }
      function renderViewport() {
        viewport.textContent = window.innerWidth + ' x ' + window.innerHeight + ' CSS px | DPR ' + (window.devicePixelRatio || 1);
      }
      async function poll() {
        try {
          var response = await fetch('/api/v1/snapshot', { cache: 'no-store' });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          var envelope = await response.json();
          var payload = envelope && envelope.message && envelope.message.payload;
          connection.textContent = 'Tracker lokal verbunden';
          connection.className = 'value ok';
          flight.textContent = payload && payload.available
            ? Number(payload.lat).toFixed(5) + ', ' + Number(payload.lon).toFixed(5) + ' | ' + Math.round(Number(payload.alt) || 0) + ' ft'
            : 'Simulatorposition nicht verfuegbar';
        } catch (error) {
          connection.textContent = 'Snapshot nicht erreichbar';
          connection.className = 'value error';
          flight.textContent = String(error && error.message || error);
        }
        window.setTimeout(poll, 1000);
      }
      document.getElementById('clickTest').onclick = function () {
        clicks += 1;
        input.textContent = clicks + (clicks === 1 ? ' Klick' : ' Klicks');
        notify('input');
      };
      document.getElementById('themeTest').onclick = function () {
        document.body.classList.toggle('alt');
        notify('theme');
      };
      window.addEventListener('resize', renderViewport);
      renderViewport();
      notify('ready');
      poll();
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  EFB_WEB_CLIENT_PATH,
  createTrackerEfbWebClientPage
};
